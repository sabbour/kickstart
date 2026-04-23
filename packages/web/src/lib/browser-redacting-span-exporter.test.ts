import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { ExportResult } from "@opentelemetry/core";
import { BrowserRedactingSpanExporter, redactBrowserSpan } from "./browser-redacting-span-exporter";

function makeSpan(overrides: Partial<ReadableSpan> = {}): ReadableSpan {
  const base = {
    name: "GET /api/converse",
    attributes: {},
    events: [],
    links: [],
    spanContext: () => ({ traceId: "a".repeat(32), spanId: "b".repeat(16), traceFlags: 1, traceState: { serialize: () => "vendor=abc" } }),
    resource: { attributes: {} },
    ...overrides,
  };
  return base as unknown as ReadableSpan;
}

describe("redactBrowserSpan — Zapp scrub table", () => {
  it("strips query + fragment from http.url", () => {
    const span = makeSpan({
      attributes: { "http.url": "https://app.example/api/converse?sessionId=abc&token=xyz#frag" },
    });
    const out = redactBrowserSpan(span);
    expect(out.attributes["http.url"]).toBe("https://app.example/api/converse");
  });

  it("strips query from url.full", () => {
    const span = makeSpan({
      attributes: { "url.full": "https://app.example/api/generate?key=secret" },
    });
    expect(redactBrowserSpan(span).attributes["url.full"]).toBe("https://app.example/api/generate");
  });

  it("coarses http.user_agent to browser family only", () => {
    const span = makeSpan({
      attributes: {
        "http.user_agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      },
    });
    expect(redactBrowserSpan(span).attributes["http.user_agent"]).toBe("Chrome");
  });

  it("redacts bearer tokens in arbitrary string attributes", () => {
    const span = makeSpan({
      attributes: { "custom.header": "Authorization: Bearer eyJabc.def.ghi" },
    });
    expect(redactBrowserSpan(span).attributes["custom.header"]).toMatch(/\[REDACTED\]/);
  });

  it("redacts api_key=… key/value pairs", () => {
    const span = makeSpan({
      attributes: { "log.message": "called with api_key=topsecretvalue" },
    });
    expect(redactBrowserSpan(span).attributes["log.message"]).toContain("[REDACTED]");
    expect(redactBrowserSpan(span).attributes["log.message"]).not.toContain("topsecretvalue");
  });

  it("scrubs event attributes recursively", () => {
    const span = makeSpan({
      events: [{ name: "exception", time: [0, 0], attributes: { "exception.message": "token=abcd1234 leaked" } }] as unknown as ReadableSpan["events"],
    });
    expect(redactBrowserSpan(span).events[0].attributes?.["exception.message"]).toContain("[REDACTED]");
  });

  it("strips traceState from spanContext()", () => {
    const span = makeSpan();
    const out = redactBrowserSpan(span);
    expect(out.spanContext().traceState).toBeUndefined();
  });

  it("leaves non-sensitive attributes untouched", () => {
    const span = makeSpan({ attributes: { "http.status_code": 200, "http.method": "POST" } });
    const attrs = redactBrowserSpan(span).attributes;
    expect(attrs["http.status_code"]).toBe(200);
    expect(attrs["http.method"]).toBe("POST");
  });
});

describe("BrowserRedactingSpanExporter", () => {
  let captured: ReadableSpan[] = [];
  let inner: SpanExporter;

  beforeEach(() => {
    captured = [];
    inner = {
      export: (spans: ReadableSpan[], cb: (r: ExportResult) => void) => {
        captured = spans;
        cb({ code: 0 });
      },
      shutdown: vi.fn(() => Promise.resolve()),
      forceFlush: vi.fn(() => Promise.resolve()),
    };
  });
  afterEach(() => vi.restoreAllMocks());

  it("forwards redacted spans to the wrapped exporter", () => {
    const exp = new BrowserRedactingSpanExporter(inner);
    const span = makeSpan({ attributes: { "http.url": "/api/x?token=abc" } });
    exp.export([span], () => undefined);
    expect(captured).toHaveLength(1);
    expect(captured[0].attributes["http.url"]).toBe("/api/x");
  });

  it("delegates shutdown + forceFlush to the wrapped exporter", async () => {
    const exp = new BrowserRedactingSpanExporter(inner);
    await exp.shutdown();
    await exp.forceFlush();
    expect(inner.shutdown).toHaveBeenCalledOnce();
    expect(inner.forceFlush).toHaveBeenCalledOnce();
  });
});
