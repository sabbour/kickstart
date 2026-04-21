import appInsights, { flushAzureMonitor } from "applicationinsights";
import { useAzureMonitor } from "@azure/monitor-opentelemetry";
import { sanitizeError, sanitizeText } from "../telemetry/sanitize-error.js";

let client: appInsights.TelemetryClient | null = null;

/**
 * globalThis-keyed singleton flag for the Azure Monitor OTel distro.
 *
 * Each esbuild bundle gets its own module scope (own `let` variables), but
 * all bundles running in the same worker process share `globalThis`. Using a
 * Symbol ensures no collisions with third-party code.
 *
 * This guard prevents `useAzureMonitor()` from being called more than once
 * per worker process — which would wipe the OTel global provider and silently
 * destroy the entire telemetry pipeline.
 */
const AZMON_STARTED = Symbol.for("kickstart.azmon.started");

/**
 * Initialize the Azure Monitor OpenTelemetry distro for auto-collection of:
 *   - outbound HTTP dependencies (including global `fetch`/undici, which the
 *     classic SDK's diagnostic-channel patching does NOT cover — this is what
 *     makes @openai/agents SDK traffic to *.openai.azure.com observable)
 *   - incoming HTTP requests
 *   - unhandled exceptions
 *
 * Must be called as early as possible in process startup so instrumentation
 * is installed before any request handler issues a fetch.
 *
 * Idempotent across bundles: the globalThis symbol guard prevents double-init
 * even when multiple esbuild bundles import this module in the same worker.
 */
function startAzureMonitor(connString: string): void {
  if ((globalThis as Record<symbol, unknown>)[AZMON_STARTED]) {
    return;
  }
  try {
    useAzureMonitor({
      azureMonitorExporterOptions: { connectionString: connString },
    });
    (globalThis as Record<symbol, unknown>)[AZMON_STARTED] = true;
  } catch (err) {
    const sanitized = sanitizeError(err);
    console.error(`[AppInsights] Failed to start Azure Monitor OpenTelemetry: ${sanitized.message}`);
  }
}

function sanitizeProperties(properties: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!properties) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      typeof value === "string" ? sanitizeText(value) : value,
    ]),
  );
}

/**
 * Initialize Application Insights SDK.
 * Call this as early as possible in the function startup.
 *
 * Single-init strategy: `useAzureMonitor()` owns all auto-collection
 * (requests, dependencies, exceptions, traces). The classic `TelemetryClient`
 * is constructed directly via `new TelemetryClient(connString)` — this does NOT
 * call `setup()`/`start()`, so it does not trigger a second `useAzureMonitor()`
 * call that would wipe the OTel global provider (the root cause of #1030).
 *
 * Auto-collection knobs (`setAutoCollect*`) are removed — they only apply to
 * the classic SDK's own collection pipeline, which is no longer active. The
 * OTel distro handles all auto-collection and is not subject to those flags.
 */
export function initializeAppInsights(): appInsights.TelemetryClient {
  if (client) {
    return client;
  }

  const connString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connString) {
    console.warn("[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING not set; disabling telemetry");
    client = createNoOpClient();
    return client;
  }

  try {
    // Start the OTel distro (globalThis-guarded — safe to call from any bundle).
    startAzureMonitor(connString);

    // Construct a classic client WITHOUT calling setup()/start().
    // `new TelemetryClient(connString)` piggybacks on the already-initialized
    // OTel exporter; it does not re-run useAzureMonitor().
    client = new appInsights.TelemetryClient(connString);

    client.addTelemetryProcessor((envelope) => {
      const baseData = envelope.data?.baseData as {
        message?: string;
        exceptions?: Array<{ message?: string; stack?: string }>;
        properties?: Record<string, unknown>;
      } | undefined;

      if (!baseData) {
        return true;
      }

      if (baseData.message) {
        baseData.message = sanitizeText(baseData.message);
      }

      if (baseData.exceptions) {
        for (const exception of baseData.exceptions) {
          const sanitizedException = sanitizeError(
            new Error(exception.message ?? baseData.message ?? "Application Insights exception"),
          );
          exception.message = sanitizedException.message;
          if (exception.stack) {
            exception.stack = sanitizeText(exception.stack);
          }
        }
      }

      const sanitizedProperties = sanitizeProperties(baseData.properties);
      if (sanitizedProperties) {
        baseData.properties = sanitizedProperties;
      }

      return true;
    });

    client.trackTrace({
      message: "[AppInsights] Application Insights initialized successfully (Azure Monitor OTel auto-collection enabled)",
      severity: "Information",
    });

    return client;
  } catch (err) {
    const sanitizedError = sanitizeError(err);
    console.error(`[AppInsights] Failed to initialize: ${sanitizedError.message}`);
    client = createNoOpClient();
    return client;
  }
}

/**
 * Flush all pending telemetry to Application Insights.
 *
 * Awaitable. Call after `trackException` in error handlers and in `finally`
 * blocks of long-lived handlers. Azure Functions tears down the process fast
 * after invocation — without an explicit flush, telemetry queued after the
 * last auto-flush interval is silently lost.
 *
 * Never propagates errors: telemetry is non-critical path and a flush failure
 * must never mask the original business error. Logs failures via console.error
 * so operators can detect a broken pipeline from Function logs.
 */
export async function flushAppInsights(): Promise<void> {
  try {
    await client?.flush();
    await flushAzureMonitor();
  } catch (err) {
    console.error("[AppInsights] flush failed:", sanitizeError(err instanceof Error ? err : new Error(String(err))).message);
  }
}


export function getAppInsightsClient(): appInsights.TelemetryClient {
  if (!client) {
    return initializeAppInsights();
  }
  return client;
}

/**
 * No-op telemetry client for when App Insights is disabled.
 */
function createNoOpClient(): appInsights.TelemetryClient {
  return {
    trackTrace: () => undefined,
    trackEvent: () => undefined,
    trackException: () => undefined,
    trackRequest: () => undefined,
    trackDependency: () => undefined,
    addTelemetryProcessor: () => undefined,
    flush: () => Promise.resolve(),
    context: { tags: {} },
  } as unknown as appInsights.TelemetryClient;
}

/**
 * Add custom properties to every telemetry item.
 */
export function setAppInsightsContext(key: string, value: string): void {
  if (client) {
    client.context.tags[`ai.cloud.${key}`] = sanitizeText(value);
  }
}

/**
 * Eagerly install Azure Monitor OpenTelemetry auto-instrumentation at module
 * load time. Because handler files import this module at the top of their
 * source, this side effect runs before any request handler executes — which
 * is required for the undici/fetch instrumentation to monkey-patch the global
 * fetch before the @openai/agents SDK issues its first outbound call.
 *
 * The globalThis-keyed guard in startAzureMonitor() ensures this is a no-op
 * for every bundle after the first one that runs in the worker process.
 *
 * The classic SDK client (initializeAppInsights) remains lazy — it only kicks
 * in on the first request so we don't pay its init cost during cold starts
 * that never receive traffic.
 */
{
  const connString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (connString) {
    startAzureMonitor(connString);
  }
}
