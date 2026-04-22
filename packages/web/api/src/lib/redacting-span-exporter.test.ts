/**
 * T9 — SpanProcessor redaction (DP #1030 amendments 2+3).
 *
 * Uses a real BasicTracerProvider from @opentelemetry/sdk-trace-base so that
 * the SpanImpl prototype chain (spanContext() method, duration/ended getters)
 * matches production exactly. This guarantees future SDK changes to the real
 * prototype are caught here rather than by the hand-rolled FakeSpanImpl that
 * previously drifted from the SDK.
 *
 * The root vitest.config.ts aliases @opentelemetry/api to a harness stub, but
 * BasicTracerProvider only needs context.active() (→ returns {}) and diag
 * (→ no-op logging) from that stub — both are present. Span construction and
 * the prototype chain come entirely from sdk-trace-base and are unaffected.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import type { SpanExporter, ExportResult } from "@opentelemetry/sdk-trace-base";
import { RedactingSpanExporter, redactSpan } from "./redacting-span-exporter.js";

class CapturingExporter implements SpanExporter {
  captured: ReadableSpan[] = [];
  export(spans: ReadableSpan[], resultCallback: (r: ExportResult) => void): void {
    this.captured.push(...spans);
    resultCallback({ code: 0 });
  }
  shutdown(): Promise<void> { return Promise.resolve(); }
  forceFlush(): Promise<void> { return Promise.resolve(); }
}

describe("RedactingSpanExporter (T9)", () => {
  let tracerProvider: BasicTracerProvider;

  beforeEach(() => {
    tracerProvider = new BasicTracerProvider();
  });

  afterEach(async () => {
    await tracerProvider.shutdown();
  });

  it("scrubs URLs, attributes, and exception events while preserving prototype methods + getters", async () => {
    const sink = new CapturingExporter();
    const exporter = new RedactingSpanExporter(sink);

    const tracer = tracerProvider.getTracer("test");
    const span = tracer.startSpan("unit-under-test");
    span.setAttribute("http.url", "https://example.com/api/health?code=SECRET&api-key=abc");
    span.setAttribute(
      "note",
      "contains APPLICATIONINSIGHTS_CONNECTION_STRING=Endpoint=https://example.in.applicationinsights.azure.com/;InstrumentationKey=00000000-0000-0000-0000-000000000001 should disappear",
    );
    span.addEvent("exception", {
      "exception.type": "Error",
      "exception.message": "bearer eyJhbGciOi.abc.def should vanish",
      "exception.stacktrace": "Error: bearer eyJhbGciOi.abc.def\n  at fn (/secret/path.ts:1:1)",
    });
    span.end();

    const readableSpan = span as unknown as ReadableSpan;

    await new Promise<void>((resolve) =>
      exporter.export([readableSpan], () => resolve()),
    );

    expect(sink.captured).toHaveLength(1);
    const exported = sink.captured[0];

    // (1) Prototype method preservation — TypeError if object-spread was used.
    expect(typeof exported.spanContext).toBe("function");
    expect(exported.spanContext().traceId).toMatch(/^[0-9a-f]{32}$/);

    // (2) Getter-backed fields survive Proxy wrap.
    expect(exported.ended).toBe(true);
    expect(Array.isArray(exported.duration)).toBe(true);

    // (3) URL attribute — query string stripped.
    const httpUrl = exported.attributes["http.url"] as string;
    expect(httpUrl).not.toContain("SECRET");
    expect(httpUrl).not.toContain("api-key=abc");
    expect(httpUrl).toContain("?<redacted>");

    // (4) Non-URL strings — sanitizeText scrubs connection-string env markers.
    const note = exported.attributes["note"] as string;
    expect(note).not.toContain("Endpoint=https://example.in.applicationinsights.azure.com");
    expect(note).toContain("[REDACTED]");

    // (5) Exception event attributes scrubbed.
    const evt = exported.events.find((e) => e.name === "exception");
    expect(evt).toBeDefined();
    const evtAttrs = evt!.attributes ?? {};
    expect(String(evtAttrs["exception.message"])).not.toContain("eyJhbGciOi.abc.def");
    expect(String(evtAttrs["exception.stacktrace"])).not.toContain("eyJhbGciOi.abc.def");

    // (6) No secret substring anywhere in exported JSON view.
    const spanJson = JSON.stringify({
      attributes: exported.attributes,
      events: exported.events.map((e) => ({ name: e.name, attributes: e.attributes })),
    });
    expect(spanJson).not.toContain("SECRET");
    expect(spanJson).not.toContain("eyJhbGciOi.abc.def");
  });

  it("redactSpan returns a Proxy view, not a mutated input reference", () => {
    const tracer = tracerProvider.getTracer("test");
    const span = tracer.startSpan("unit-under-test");
    span.setAttribute("http.url", "https://x/?code=S");
    span.end();
    const readableSpan = span as unknown as ReadableSpan;
    const out = redactSpan(readableSpan);
    expect(out).not.toBe(readableSpan);
    expect((out.attributes["http.url"] as string)).toContain("?<redacted>");
    // Original input attributes must remain untouched.
    expect((readableSpan.attributes["http.url"] as string)).toContain("code=S");
  });
});
