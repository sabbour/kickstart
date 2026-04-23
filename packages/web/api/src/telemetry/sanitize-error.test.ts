import { describe, expect, it } from "vitest";
import { sanitizeError, sanitizeText } from "./sanitize-error.js";

describe("sanitizeText", () => {
  it("redacts bearer tokens and JWTs", () => {
    const raw = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.signature";
    const sanitized = sanitizeText(raw);

    expect(sanitized).toContain("Authorization: Bearer [REDACTED]");
    expect(sanitized).not.toContain("eyJhbGci");
  });

  it("redacts connection string segments", () => {
    const raw = "DefaultEndpointsProtocol=https;AccountName=myacct;AccountKey=abc123;EndpointSuffix=core.windows.net";
    const sanitized = sanitizeText(raw);

    expect(sanitized).toContain("DefaultEndpointsProtocol=[REDACTED]");
    expect(sanitized).toContain("AccountName=[REDACTED]");
    expect(sanitized).toContain("AccountKey=[REDACTED]");
    expect(sanitized).toContain("EndpointSuffix=[REDACTED]");
    expect(sanitized).not.toContain("abc123");
  });

  it("redacts query-string secrets", () => {
    const raw = "https://example.com?code=super-secret&sig=abc123&api-key=xyz";
    const sanitized = sanitizeText(raw);

    expect(sanitized).toContain("code=[REDACTED]");
    expect(sanitized).toContain("sig=[REDACTED]");
    expect(sanitized).not.toContain("super-secret");
    expect(sanitized).not.toContain("abc123");
  });
});

describe("sanitizeError", () => {
  it("redacts secrets in the error message and stack", () => {
    const error = new Error("token=shh apiKey=abc123");
    error.stack = "Error: token=shh\n    at run (file.ts:1:1)\n    at bearer abc.def.ghi";

    const sanitized = sanitizeError(error);

    expect(sanitized.message).toBe("token=[REDACTED] apiKey=[REDACTED]");
    expect(sanitized.stack).toContain("token=[REDACTED]");
    expect(sanitized.stack).toContain("bearer [REDACTED]");
    expect(sanitized.stack).not.toContain("abc123");
    expect(sanitized.stack).not.toContain("shh");
  });

  it("preserves the error name", () => {
    const error = new TypeError("secret=abc123");
    const sanitized = sanitizeError(error);

    expect(sanitized.name).toBe("TypeError");
    expect(sanitized.message).toBe("secret=[REDACTED]");
  });
});
