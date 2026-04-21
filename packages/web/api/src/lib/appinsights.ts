/**
 * Application Insights / Azure Monitor OpenTelemetry wiring for the API
 * Functions worker.
 *
 * ## Design contract (DP #1030, amendments 1–3)
 *
 * - **Single-init.** `useAzureMonitor()` is the only OTel bootstrap in this
 *   process. `applicationinsights`'s classic SDK is never imported from API
 *   code (enforced via ESLint `no-restricted-imports`). That kills the
 *   "double useAzureMonitor() wipes the OTel global registry" defect.
 * - **Pure OTel manual telemetry.** `trackException` / `trackTrace` /
 *   `trackEvent` emit through `@opentelemetry/api` / `@opentelemetry/api-logs`
 *   so they inherit the same pipeline (RedactingSpanExporter,
 *   RedactingLogRecordProcessor, instrumentation hooks) as auto-collected
 *   telemetry.
 * - **Redaction is defense-in-depth.** Helpers pre-sanitize at the boundary;
 *   RedactingSpanExporter rewrites attributes again before export;
 *   RedactingLogRecordProcessor sanitizes log bodies. HTTP instrumentation
 *   hooks strip query strings before the redactor runs.
 * - **Bundled safely.** Both `@azure/monitor-opentelemetry` and the OTel API
 *   packages are marked external in `esbuild.config.mjs` and materialized
 *   into `packages/web/api/node_modules/` via the postbuild script so every
 *   function bundle shares the same module identity and `globalThis` singletons.
 * - **Flush is awaitable.** `flushAppInsights()` inlines the three
 *   `forceFlush()` calls that `applicationinsights.flushAzureMonitor` does
 *   internally (trace delegate → logger → meter). Nothing is re-exported
 *   from `applicationinsights`.
 */

import {
  trace,
  metrics,
  SpanStatusCode,
  type Attributes,
  type Span,
  type TracerProvider,
} from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { useAzureMonitor } from "@azure/monitor-opentelemetry";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ClientRequest } from "node:http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { AzureMonitorTraceExporter } from "@azure/monitor-opentelemetry-exporter";
import { RedactingSpanExporter } from "./redacting-span-exporter.js";
import { RedactingLogRecordProcessor } from "./redacting-log-processor.js";
import { sanitizeError, sanitizeText } from "../telemetry/sanitize-error.js";

const TRACER_NAME = "@aks-kickstart/api";
const LOGGER_NAME = "@aks-kickstart/api";

/**
 * globalThis-keyed init flag. Even with `@azure/monitor-opentelemetry`
 * externalized in esbuild, `initializeAppInsights()` can be invoked from
 * multiple handler bundles within the same worker process — we only want
 * one `useAzureMonitor()` call per process.
 */
const STARTED = Symbol.for("kickstart.azmon.started");

type MaybeForceFlush = { forceFlush?: () => Promise<void> };

function isStarted(): boolean {
  return Boolean((globalThis as Record<symbol, unknown>)[STARTED]);
}

function markStarted(): void {
  (globalThis as Record<symbol, unknown>)[STARTED] = true;
}

function redactUrlInPlace(
  span: Span,
  keys: readonly string[],
): void {
  for (const key of keys) {
    const attrs = (span as unknown as { attributes?: Attributes }).attributes;
    const current = attrs?.[key];
    if (typeof current === "string") {
      const qIdx = current.indexOf("?");
      if (qIdx >= 0) {
        span.setAttribute(key, `${current.slice(0, qIdx)}?<redacted>`);
      }
    }
  }
}

function buildHttpHooks() {
  const URL_ATTRS = ["http.url", "url.full", "http.target", "url.path", "http.route"] as const;
  return {
    requestHook: (span: Span, _req: ClientRequest | IncomingMessage): void => {
      redactUrlInPlace(span, URL_ATTRS);
    },
    responseHook: (span: Span, _res: IncomingMessage | ServerResponse): void => {
      redactUrlInPlace(span, URL_ATTRS);
    },
    applyCustomAttributesOnSpan: (
      span: Span,
      _req: ClientRequest | IncomingMessage,
      _res: IncomingMessage | ServerResponse,
    ): void => {
      redactUrlInPlace(span, URL_ATTRS);
    },
  };
}

/**
 * Initialize the Azure Monitor OpenTelemetry distro exactly once per worker
 * process. Safe to call from any number of bundles / handlers — subsequent
 * calls are a cheap no-op.
 *
 * Telemetry-init failures MUST NOT propagate: the API continues to serve
 * requests; manual `trackX` helpers fall back to no-op tracer/logger.
 */
export function initializeAppInsights(): void {
  if (isStarted()) return;

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString) {
    console.warn(
      "[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING not set; telemetry disabled",
    );
    markStarted();
    return;
  }

  try {
    const redactingExporter = new RedactingSpanExporter(
      new AzureMonitorTraceExporter({ connectionString }),
    );

    useAzureMonitor({
      azureMonitorExporterOptions: { connectionString },
      spanProcessors: [new BatchSpanProcessor(redactingExporter)],
      logRecordProcessors: [new RedactingLogRecordProcessor()],
      instrumentationOptions: {
        http: {
          enabled: true,
          ...buildHttpHooks(),
          // Do NOT set headersToSpanAttributes — defaults do not capture
          // auth/cookie/key headers and we want to keep it that way.
        },
      },
    });

    markStarted();
  } catch (err) {
    const sanitized = sanitizeError(err);
    console.error(`[AppInsights] Azure Monitor init failed: ${sanitized.message}`);
    // Set the flag anyway so we don't retry the failing init on every request.
    markStarted();
  }
}

function sanitizeProperties(
  properties: Record<string, unknown> | undefined,
): Attributes | undefined {
  if (!properties) return undefined;
  const out: Attributes = {};
  for (const [k, v] of Object.entries(properties)) {
    if (typeof v === "string") out[k] = sanitizeText(v);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (v == null) continue;
    else out[k] = sanitizeText(String(v));
  }
  return out;
}

/**
 * Emit an exception span. Equivalent to the old
 * `client.trackException({ exception, properties })`.
 */
export function trackException(
  err: unknown,
  properties?: Record<string, unknown>,
): void {
  try {
    const tracer = trace.getTracer(TRACER_NAME);
    const sanitized = sanitizeError(err);
    const attrs = sanitizeProperties(properties);
    const span = tracer.startSpan("exception", attrs ? { attributes: attrs } : undefined);
    span.recordException(sanitized);
    span.setStatus({ code: SpanStatusCode.ERROR, message: sanitized.message });
    span.end();
  } catch {
    /* telemetry must never throw into business code */
  }
}

/**
 * Emit a log record. Equivalent to `client.trackTrace({ message, severity, properties })`.
 */
export function trackTrace(
  message: string,
  properties?: Record<string, unknown>,
  severityNumber: SeverityNumber = SeverityNumber.INFO,
): void {
  try {
    const logger = logs.getLogger(LOGGER_NAME);
    const attrs = sanitizeProperties(properties);
    logger.emit({
      body: sanitizeText(message),
      severityNumber,
      ...(attrs ? { attributes: attrs } : {}),
    });
  } catch {
    /* never throw */
  }
}

/**
 * Emit a custom-event span. Equivalent to `client.trackEvent({ name, properties })`.
 */
export function trackEvent(
  name: string,
  properties?: Record<string, unknown>,
): void {
  try {
    const tracer = trace.getTracer(TRACER_NAME);
    const attrs = sanitizeProperties(properties);
    const span = tracer.startSpan(
      `event.${name}`,
      attrs ? { attributes: attrs } : undefined,
    );
    span.end();
  } catch {
    /* never throw */
  }
}

/**
 * Force-flush the OTel providers that back Azure Monitor. Inlines the three
 * `forceFlush()` calls that `applicationinsights.flushAzureMonitor()` does
 * internally (see applicationinsights/out/src/main.js). Using pure OTel APIs
 * keeps `applicationinsights` out of the API code path.
 *
 * Best-effort: never propagates errors; flushing is not on the critical path
 * and must not mask the originating business error.
 */
export async function flushAppInsights(): Promise<void> {
  if (!isStarted()) return;
  try {
    const tracerProvider = trace.getTracerProvider() as TracerProvider & {
      getDelegate?: () => MaybeForceFlush;
      forceFlush?: () => Promise<void>;
    };
    const delegate = tracerProvider.getDelegate?.();
    if (delegate?.forceFlush) {
      await delegate.forceFlush();
    } else if (tracerProvider.forceFlush) {
      await tracerProvider.forceFlush();
    }

    const loggerProvider = logs.getLoggerProvider() as MaybeForceFlush;
    if (loggerProvider.forceFlush) await loggerProvider.forceFlush();

    const meterProvider = metrics.getMeterProvider() as MaybeForceFlush;
    if (meterProvider.forceFlush) await meterProvider.forceFlush();
  } catch {
    // Best-effort — container teardown frequently races the network.
  }
}

/**
 * Module-load side effect: start the distro ASAP so that instrumentation
 * is installed before any request handler issues a fetch.
 *
 * The globalThis-keyed guard makes this safe to run from every bundle that
 * imports this module; only the first call actually calls useAzureMonitor.
 */
{
  initializeAppInsights();
}
