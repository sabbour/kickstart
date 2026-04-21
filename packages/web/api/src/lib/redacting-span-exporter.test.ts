/**
 * T9 — SpanProcessor redaction (DP #1030 amendments 2+3).
 *
 * We do NOT construct a real BasicTracerProvider here because the root
 * `vitest.config.ts` aliases `@opentelemetry/api` to a minimal harness stub
 * (the real OTel API isn't needed for most unit tests). Instead we feed the
 * exporter hand-built ReadableSpan objects whose shape exercises the two
 * hazards the redactor has to survive:
 *   1. Prototype methods (`spanContext()`) — must not be lost by `{...span}`.
 *   2. Getter-backed fields (`duration`, `ended`) on a class prototype —
 *      must not be lost by `{...span}`.
 *
 * If redactSpan ever regresses to an object-spread clone, tests (1) and (2)
 * will surface TypeError / undefined access the way production would.
 */

import { describe, it, expect } from "vitest";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import type { SpanExporter, ExportResult } from "@opentelemetry/sdk-trace-base";
import { RedactingSpanExporter, redactSpan } from "./redacting-span-exporter.js";

// Minimal SpanImpl-style class with prototype methods + getters, mirroring
// the real @opentelemetry/sdk-trace-base SpanImpl surface that tripped us up.
class FakeSpanImpl {
  name = "unit-under-test";
  kind = 0;
  startTime: [number, number] = [0, 0];
  endTime: [number, number] = [0, 0];
  status = { code: 0 };
  attributes: Record<string, unknown> = {};
  links: unknown[] = [];
  events: { name: string; attributes: Record<string, unknown>; time: [number, number] }[] = [];
  resource = { attributes: {}, merge() { return this; } };
  instrumentationScope = { name: "test" };
  droppedAttributesCount = 0;
  droppedEventsCount = 0;
  droppedLinksCount = 0;
  _ctx = { traceId: "a".repeat(32), spanId: "b".repeat(16), traceFlags: 1 };

  spanContext() { return this._ctx; }
  get duration(): [number, number] { return [0, 0]; }
  get ended(): boolean { return true; }
}

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
  it("scrubs URLs, attributes, and exception events while preserving prototype methods + getters", async () => {
    const sink = new CapturingExporter();
    const exporter = new RedactingSpanExporter(sink);

    const span = new FakeSpanImpl() as unknown as ReadableSpan;
    (span as FakeSpanImpl).attributes = {
      "http.url": "https://example.com/api/health?code=SECRET&api-key=abc",
      "note": "contains APPLICATIONINSIGHTS_CONNECTION_STRING=Endpoint=https://example.in.applicationinsights.azure.com/;InstrumentationKey=00000000-0000-0000-0000-000000000001 should disappear",
    };
    (span as FakeSpanImpl).events = [{
      name: "exception",
      time: [0, 0],
      attributes: {
        "exception.type": "Error",
        "exception.message": "bearer eyJhbGciOi.abc.def should vanish",
        "exception.stacktrace": "Error: bearer eyJhbGciOi.abc.def\n  at fn (/secret/path.ts:1:1)",
      },
    }];

    await new Promise<void>((resolve) =>
      exporter.export([span], () => resolve()),
    );

    expect(sink.captured).toHaveLength(1);
    const exported = sink.captured[0];

    // (1) Prototype method preservation — TypeError if object-spread was used.
    expect(typeof exported.spanContext).toBe("function");
    expect(exported.spanContext().traceId).toBe("a".repeat(32));

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
    const span = new FakeSpanImpl() as unknown as ReadableSpan;
    (span as FakeSpanImpl).attributes = { "http.url": "https://x/?code=S" };
    const out = redactSpan(span);
    expect(out).not.toBe(span);
    expect((out.attributes["http.url"] as string)).toContain("?<redacted>");
    // Original input attributes must remain untouched.
    expect(((span as FakeSpanImpl).attributes["http.url"] as string)).toContain("code=S");
  });
});
