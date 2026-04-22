import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { ExportResult } from "@opentelemetry/core";
import { redactBrowserAttributes } from "./browser-redact-attrs";

/**
 * Browser mirror of `packages/web/api/src/lib/redacting-span-exporter.ts`.
 *
 * Wraps any downstream SpanExporter (in production: `AzureMonitorTraceExporter`)
 * and presents each ReadableSpan via a Proxy with:
 *   - `attributes`, `events[].attributes`, `links[].attributes` scrubbed
 *   - `spanContext()` rewritten so `traceState` is stripped before export
 *     (Zapp Decision 3 — `tracestate` never leaves the browser)
 *
 * Why Proxy, not object-spread: the Azure Monitor exporter calls
 * `span.spanContext().traceId` and walks prototype methods. `{...span}` drops
 * those. The server-side exporter uses the same pattern for the same reason.
 */
export function redactBrowserSpan(span: ReadableSpan): ReadableSpan {
  const redactedAttributes = redactBrowserAttributes(span.attributes);
  const redactedEvents = span.events.map((e) => ({
    ...e,
    attributes: e.attributes ? redactBrowserAttributes(e.attributes) : e.attributes,
  }));
  const redactedLinks = (span.links ?? []).map((link) => ({
    ...link,
    attributes: link.attributes ? redactBrowserAttributes(link.attributes) : link.attributes,
  }));

  return new Proxy(span, {
    get(target, prop, _receiver) {
      if (prop === "attributes") return redactedAttributes;
      if (prop === "events") return redactedEvents;
      if (prop === "links") return redactedLinks;
      if (prop === "spanContext") {
        // Rewrap to strip traceState. Injection-vector avoidance per DP §3.
        return () => {
          const ctx = (target.spanContext as () => ReturnType<ReadableSpan["spanContext"]>).call(target);
          return { ...ctx, traceState: undefined };
        };
      }
      if (prop === "resource") {
        const res = Reflect.get(target, prop, target);
        return new Proxy(res, {
          get(rTarget, rProp, _r) {
            if (rProp === "attributes") return redactBrowserAttributes((rTarget as { attributes?: Record<string, unknown> }).attributes ?? {});
            const v = Reflect.get(rTarget, rProp, rTarget);
            return typeof v === "function" ? (v as (...args: unknown[]) => unknown).bind(rTarget) : v;
          },
        });
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  }) as ReadableSpan;
}

export class BrowserRedactingSpanExporter implements SpanExporter {
  constructor(private readonly inner: SpanExporter) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    this.inner.export(spans.map(redactBrowserSpan), resultCallback);
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.inner.forceFlush ? this.inner.forceFlush() : Promise.resolve();
  }
}
