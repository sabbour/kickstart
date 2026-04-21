import type {
  ReadableSpan,
  SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import type { ExportResult } from "@opentelemetry/core";
import { redactAttributes } from "./redact-attrs.js";

/**
 * Proxy-based decorator that presents a ReadableSpan view with scrubbed
 * `attributes` and `events[].attributes` while preserving prototype methods
 * (notably `spanContext()` on `SpanImpl.prototype`) and getter-backed
 * properties (`duration`, `ended`, `droppedAttributesCount`, …).
 *
 * Why Proxy instead of object-spread: `{...span}` drops prototype methods;
 * `AzureMonitorTraceExporter.export()` calls `span.spanContext().traceId`
 * and would throw `TypeError: span.spanContext is not a function`.
 *
 * Why decorator instead of SpanProcessor.onEnd: `ReadableSpan.attributes`
 * is `readonly` in the SDK type; mutation relies on implementation detail.
 * The `onEnding` hook is flagged `@experimental` — unacceptable on a
 * security-critical redaction path.
 */
export function redactSpan(span: ReadableSpan): ReadableSpan {
  const redactedAttributes = redactAttributes(span.attributes);
  const redactedEvents = span.events.map((e) => ({
    ...e,
    attributes: e.attributes ? redactAttributes(e.attributes) : e.attributes,
  }));

  return new Proxy(span, {
    get(target, prop, _receiver) {
      if (prop === "attributes") return redactedAttributes;
      if (prop === "events") return redactedEvents;
      // Force `this === target` so prototype methods (spanContext) and
      // getters (duration, ended, droppedAttributesCount, …) bind to the
      // real SpanImpl instance. Functions are rebound defensively in case
      // a caller detaches them (`const fn = span.spanContext; fn();`).
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? (value as Function).bind(target) : value;
    },
  }) as ReadableSpan;
}

export class RedactingSpanExporter implements SpanExporter {
  constructor(private readonly inner: SpanExporter) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    this.inner.export(spans.map(redactSpan), resultCallback);
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.inner.forceFlush ? this.inner.forceFlush() : Promise.resolve();
  }
}
