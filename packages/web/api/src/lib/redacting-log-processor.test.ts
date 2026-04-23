/**
 * T10 — LogRecordProcessor redaction (DP #1030 amendment 1).
 *
 * Drives the processor directly with a fake SdkLogRecord rather than a real
 * LoggerProvider because the root `vitest.config.ts` aliases
 * `@opentelemetry/api` to a minimal harness stub.
 */

import { describe, it, expect } from "vitest";
import { RedactingLogRecordProcessor } from "./redacting-log-processor.js";

function makeRecord(body: unknown, attributes: Record<string, unknown>) {
  let bodyInternal = body;
  let attrsInternal: Record<string, unknown> = { ...attributes };
  return {
    get body() { return bodyInternal; },
    set body(v: unknown) { bodyInternal = v; },
    get attributes() { return attrsInternal; },
    setAttributes(next: Record<string, unknown>) {
      attrsInternal = { ...attrsInternal, ...next };
    },
  };
}

describe("RedactingLogRecordProcessor (T10)", () => {
  it("scrubs bearer tokens from body and attributes in onEmit", () => {
    const processor = new RedactingLogRecordProcessor();
    const rec = makeRecord("auth failed: Bearer eyJhbGciOi.abc.def", {
      context: "request: Bearer eyJhbGciOi.xyz",
      "http.url": "https://x/?code=SECRET",
    });

    // processor.onEmit takes (record, context) — we pass a null context;
    // implementation ignores it.
    processor.onEmit(rec as never, undefined as never);

    expect(String(rec.body)).not.toContain("eyJhbGciOi.abc.def");
    expect(String(rec.attributes["context"])).not.toContain("eyJhbGciOi.xyz");
    expect(String(rec.attributes["http.url"])).not.toContain("SECRET");
    expect(String(rec.attributes["http.url"])).toContain("?<redacted>");
  });

  it("survives a throwing sanitize input without propagating (never mask log emission)", () => {
    const processor = new RedactingLogRecordProcessor();
    // A body that triggers sanitize failure (Symbol → String conversion bails
    // inside sanitizeText's regex — but redactor must swallow).
    const rec = makeRecord(Symbol("weird") as unknown, { a: "ok" });
    expect(() => processor.onEmit(rec as never, undefined as never)).not.toThrow();
  });
});
