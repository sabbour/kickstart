/**
 * Application Insights / Azure Monitor OpenTelemetry wiring for the API
 * Functions worker.
 *
 * ## Design contract (DP #1030, amendments 1–3; DP #1035 security fix)
 *
 * - **Single trace path (DP #1035).** The ONLY trace export path is:
 *   `OTel global TracerProvider → BatchSpanProcessor(RedactingSpanExporter(AzureMonitorTraceExporter))`.
 *   `useAzureMonitor()` is NOT used — it always registers its own internal
 *   `BatchSpanProcessor(AzureMonitorTraceExporter)` alongside any user-supplied
 *   `spanProcessors`, creating a double-export (raw PII leak).  Option A of
 *   DP-A was validated and found infeasible: the distro's TraceHandler creates
 *   its internal exporter unconditionally, falling back to the
 *   APPLICATIONINSIGHTS_CONNECTION_STRING env var even when
 *   `azureMonitorExporterOptions` is omitted.  Option B (NodeSDK direct) is
 *   therefore implemented here.
 * - **Pure OTel manual telemetry.** `trackException` / `trackTrace` /
 *   `trackEvent` emit through `@opentelemetry/api` / `@opentelemetry/api-logs`
 *   so they inherit the same pipeline (RedactingSpanExporter,
 *   RedactingLogRecordProcessor, instrumentation hooks) as auto-collected
 *   telemetry.
 * - **Redaction is defense-in-depth.** Helpers pre-sanitize at the boundary;
 *   RedactingSpanExporter rewrites span attributes, events, links, and resource
 *   attributes before export; RedactingLogRecordProcessor sanitizes log bodies.
 *   HTTP instrumentation hooks strip query strings before the redactor runs.
 * - **Bundled inline with globalThis singleton.** All OTel packages are bundled
 *   into each function by esbuild. Multiple bundled copies in the same worker
 *   process share the same OTel state via
 *   `globalThis[Symbol.for('opentelemetry.js.api.1')]`.
 * - **Flush is awaitable.** `flushAppInsights()` inlines the three
 *   `forceFlush()` calls (trace delegate → logger → meter). Nothing is
 *   re-exported from `applicationinsights` or `@azure/monitor-opentelemetry`.
 *
 * ## CI guard
 * `ci.yml` contains a grep step that fails if `azureMonitorExporterOptions`
 * appears alongside `spanProcessors` in this file. Do not re-introduce the
 * pattern — it creates an unredacted duplicate export path.
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
import { NodeSDK } from "@opentelemetry/sdk-node";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ClientRequest } from "node:http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import {
  AzureMonitorTraceExporter,
  AzureMonitorLogExporter,
  AzureMonitorMetricExporter,
} from "@azure/monitor-opentelemetry-exporter";
import { RedactingSpanExporter } from "./redacting-span-exporter.js";
import { RedactingLogRecordProcessor } from "./redacting-log-processor.js";
import { sanitizeError, sanitizeText } from "../telemetry/sanitize-error.js";

const TRACER_NAME = "@aks-kickstart/api";
const LOGGER_NAME = "@aks-kickstart/api";

/**
 * globalThis-keyed init flag. `@opentelemetry/api` stores its provider
 * registry on `globalThis[Symbol.for('opentelemetry.js.api.1')]`, so multiple
 * bundled copies of the package in the same worker process all read/write the
 * same slot. The STARTED flag below uses the same mechanism: even with
 * OTel packages bundled inline per-function, `initializeAppInsights()` is
 * called only once per worker process.
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
 * Initialize the OpenTelemetry SDK exactly once per worker process, wiring
 * Azure Monitor exporters through the redacting pipeline.
 *
 * **Trace pipeline (single path):** NodeSDK registers exactly one
 * BatchSpanProcessor wrapping RedactingSpanExporter(AzureMonitorTraceExporter).
 * No raw AzureMonitorTraceExporter is registered outside this wrapper.
 *
 * **Log pipeline:** RedactingLogRecordProcessor runs before
 * BatchLogRecordProcessor(AzureMonitorLogExporter), ensuring logs are scrubbed
 * before they leave the SDK.
 *
 * **Metric pipeline:** PeriodicExportingMetricReader(AzureMonitorMetricExporter)
 * provides standard metric export to App Insights.
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
    // Trace: single redacting path only. RedactingSpanExporter wraps the raw
    // exporter so NO unredacted span data reaches App Insights.
    const traceExporter = new AzureMonitorTraceExporter({ connectionString });
    const redactingSpanExporter = new RedactingSpanExporter(traceExporter);
    const spanProcessor = new BatchSpanProcessor(redactingSpanExporter);

    // Logs: redacting processor runs before the batch processor.
    const logExporter = new AzureMonitorLogExporter({ connectionString });
    const batchLogProcessor = new BatchLogRecordProcessor(logExporter);

    // Metrics: standard periodic export.
    const metricExporter = new AzureMonitorMetricExporter({ connectionString });
    const metricReader = new PeriodicExportingMetricReader({ exporter: metricExporter });

    const sdk = new NodeSDK({
      spanProcessors: [spanProcessor],
      logRecordProcessors: [new RedactingLogRecordProcessor(), batchLogProcessor],
      metricReaders: [metricReader],
      instrumentations: [
        new HttpInstrumentation({
          enabled: true,
          ...buildHttpHooks(),
          // Do NOT set headersToSpanAttributes — defaults do not capture
          // auth/cookie/key headers and we want to keep it that way.
        }),
      ],
    });
    sdk.start();

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
 * Module-load side effect: initialize telemetry ASAP so instrumentation is
 * active before any request handler issues a fetch or logs a record.
 *
 * The globalThis-keyed guard makes this safe to run from every bundle that
 * imports this module; only the first call actually starts the NodeSDK.
 */
{
  initializeAppInsights();
}
