import appInsights from "applicationinsights";
import { useAzureMonitor } from "@azure/monitor-opentelemetry";
import { sanitizeError, sanitizeText } from "../telemetry/sanitize-error.js";

let client: appInsights.TelemetryClient | null = null;
let azureMonitorStarted = false;

/**
 * Initialize the Azure Monitor OpenTelemetry distro for auto-collection of:
 *   - outbound HTTP dependencies (including global `fetch`/undici, which the
 *     classic SDK's diagnostic-channel patching does NOT cover — this is what
 *     makes @openai/agents SDK traffic to *.openai.azure.com observable)
 *   - incoming HTTP requests
 *   - unhandled exceptions
 *   - console.log bridge → traces
 *
 * Must be called as early as possible in process startup so instrumentation
 * is installed before any request handler issues a fetch.
 *
 * Idempotent: safe to call from multiple Function entry points.
 */
function startAzureMonitor(connString: string): void {
  if (azureMonitorStarted) {
    return;
  }
  try {
    useAzureMonitor({
      azureMonitorExporterOptions: { connectionString: connString },
    });
    azureMonitorStarted = true;
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
    // Start the Azure Monitor OpenTelemetry distro FIRST so that
    // auto-instrumentation (especially undici/fetch) is hooked before the
    // classic SDK wires its diagnostic-channel patches. Both SDKs share the
    // same connection string and co-exist safely: classic handles our
    // existing custom trackEvent/trackException/trackTrace call sites while
    // OTel owns auto-collection.
    startAzureMonitor(connString);

    appInsights
      .setup(connString)
      .setAutoCollectConsole(false)
      // Auto-collection is delegated to the Azure Monitor OpenTelemetry
      // distro (which covers undici/global fetch — the classic SDK does not).
      // Disabling here prevents double-counted requests, dependencies, and
      // exceptions in the portal.
      .setAutoCollectExceptions(false)
      .setAutoCollectRequests(false)
      .setAutoCollectDependencies(false);

    appInsights.start();
    client = appInsights.defaultClient;

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
      severity: appInsights.Contracts.SeverityLevel.Information,
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
 * Get the existing Application Insights client, or initialize if needed.
 */
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
 * The classic SDK (initializeAppInsights) is still lazy; it only kicks in on
 * the first request so we don't pay its init cost during cold starts that
 * never receive traffic. Auto-collection is the critical path for #940 and
 * must be eager.
 */
{
  const connString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (connString) {
    startAzureMonitor(connString);
  }
}
