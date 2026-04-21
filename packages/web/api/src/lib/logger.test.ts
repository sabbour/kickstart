import { describe, it, expect, vi, beforeEach } from "vitest";
import { Logger, redactSecrets, extractTraceId, extractRequestMetadata } from "./logger.js";
import type { InvocationContext } from "@azure/functions";

describe("redactSecrets", () => {
  it("redacts JWT tokens", () => {
    const input = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const result = redactSecrets(input) as string;
    expect(result).toContain("Bearer [REDACTED]");
    expect(result).not.toContain("eyJhbGc");
  });

  it("redacts API keys in JSON", () => {
    const input = '{"api_key": "sk-1234567890abcdef1234567890abcdef"}';
    const result = redactSecrets(input) as string;
    expect(result).toContain("****");
    expect(result).not.toContain("sk-1234567890");
  });

  it("redacts passwords in objects", () => {
    const input = { password: "secret123", username: "admin" };
    const result = redactSecrets(input) as Record<string, any>;
    expect(result.password).toBe("****");
    expect(result.username).toBe("admin");
  });

  it("redacts OID (object ID)", () => {
    const input = { oid: "a1b2c3d4-e5f6-47f8-a9f0-b1c2d3e4f5a6" };
    const result = redactSecrets(input) as Record<string, any>;
    expect(result.oid).toContain("xxxx");
    expect(result.oid.startsWith("a1b2c3d4")).toBe(true);
  });

  it("redacts query string secrets (?api_key=, ?code=, ?token=)", () => {
    const input = "http://localhost/api/converse?api_key=sk-1234567890abcdef&code=auth123&token=eyJ";
    const result = redactSecrets(input) as string;
    expect(result).not.toContain("sk-1234567890");
    expect(result).not.toContain("auth123");
    expect(result).not.toContain("eyJ");
    expect(result).toContain("api_key=****");
  });

  it("redacts authorization in query strings", () => {
    const input = "?authorization=Bearer%20eyJhbGc";
    const result = redactSecrets(input) as string;
    expect(result).toContain("authorization=****");
    expect(result).not.toContain("eyJhbGc");
  });

  it("redacts azure api-key in URL", () => {
    const input = "https://api.azure.com/resource?api-key=abcd1234&version=1";
    const result = redactSecrets(input) as string;
    expect(result).toContain("?api-key=****");
    expect(result).not.toContain("abcd1234");
  });

  it("redacts authorization header key in objects", () => {
    const input = { authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" };
    const result = redactSecrets(input) as Record<string, any>;
    expect(result.authorization).toBe("****");
  });

  it("redacts x-api-key header with hyphen", () => {
    const input = { "x-api-key": "sk-1234567890" };
    const result = redactSecrets(input) as Record<string, any>;
    expect(result["x-api-key"]).toBe("****");
  });

  it("redacts tenant_id and client_id GUIDs", () => {
    const input = {
      tenant_id: "a1b2c3d4-e5f6-47f8-a9f0-b1c2d3e4f5a6",
      client_id: "f5a6b7c8-d9e0-41f2-a3b4-c5d6e7f8a9b0",
    };
    const result = redactSecrets(input) as Record<string, any>;
    expect(result.tenant_id).toContain("xxxx");
    expect(result.tenant_id.startsWith("a1b2c3d4")).toBe(true);
    expect(result.client_id).toContain("xxxx");
    expect(result.client_id.startsWith("f5a6b7c8")).toBe(true);
  });

  it("redacts URL-embedded secrets in error messages", () => {
    const input = "Error calling API: GET /blobs?api-key=secret123&version=2024 returned 401";
    const result = redactSecrets(input) as string;
    expect(result).toContain("?api-key=****");
    expect(result).not.toContain("secret123");
  });

  it("redacts subscription_id in URL", () => {
    const input = "/subscriptions?subscription_id=12345678-90ab-cdef-1234-567890abcdef";
    const result = redactSecrets(input) as string;
    expect(result).toContain("subscription_id=****");
    expect(result).not.toContain("90ab-cdef");
  });

  it("handles nested objects", () => {
    const input = {
      config: {
        api_key: "secret",
        database: {
          password: "dbpass",
          host: "localhost",
        },
      },
    };
    const result = redactSecrets(input) as Record<string, any>;
    expect(result.config.api_key).toBe("****");
    expect(result.config.database.password).toBe("****");
    expect(result.config.database.host).toBe("localhost");
  });

  it("handles arrays", () => {
    const input = [{ secret: "value1" }, { secret: "value2" }];
    const result = redactSecrets(input) as Array<Record<string, any>>;
    expect(result[0].secret).toBe("****");
    expect(result[1].secret).toBe("****");
  });

  it("preserves null and undefined", () => {
    expect(redactSecrets(null)).toBe(null);
    expect(redactSecrets(undefined)).toBe(undefined);
  });
});

describe("Logger", () => {
  let mockCtx: InvocationContext;
  let logCalls: string[];

  beforeEach(() => {
    logCalls = [];
    mockCtx = {
      log: vi.fn((msg: string) => logCalls.push(msg)),
    } as any;
  });

  it("logs info messages as JSON", () => {
    const logger = new Logger(mockCtx, "test-function", "trace-123");
    logger.info("Test message", { key: "value" });

    expect(logCalls).toHaveLength(1);
    const entry = JSON.parse(logCalls[0]);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("Test message");
    expect(entry.trace_id).toBe("trace-123");
    expect(entry.function).toBe("test-function");
    expect(entry.key).toBe("value");
  });

  it("logs errors with sanitized stack traces", () => {
    const logger = new Logger(mockCtx, "test-function", "trace-123");
    const error = new Error("token=top-secret");
    error.stack = "Error: token=top-secret\n    at handler (file.ts:1:1)";

    logger.error("Failed", error, { context: "test" });

    expect(logCalls).toHaveLength(1);
    const entry = JSON.parse(logCalls[0]);
    expect(entry.level).toBe("error");
    expect(entry.error_message).toBe("token=[REDACTED]");
    expect(entry.stack_trace).toContain("token=[REDACTED]");
    expect(entry.stack_trace).not.toContain("top-secret");
    expect(entry.context).toBe("test");
  });

  it("redacts secrets in metadata", () => {
    const logger = new Logger(mockCtx, "test-function", "trace-123");
    logger.info("User login", {
      api_key: "sk-secret123",
      username: "alice",
    });

    expect(logCalls).toHaveLength(1);
    const entry = JSON.parse(logCalls[0]);
    expect(entry.api_key).toBe("****");
    expect(entry.username).toBe("alice");
  });

  it("creates child loggers with request context", () => {
    const logger = new Logger(mockCtx, "test-function", "trace-123");
    const childLogger = logger.withContext({ request_id: "req-456" });

    childLogger.info("Child message");

    expect(logCalls).toHaveLength(1);
    const entry = JSON.parse(logCalls[0]);
    expect(entry.request_id).toBe("req-456");
    expect(entry.trace_id).toBe("trace-123");
    expect(entry.function).toBe("test-function");
  });

  it("logs warnings", () => {
    const logger = new Logger(mockCtx, "test-function", "trace-123");
    logger.warn("Deprecation warning", { feature: "old-api" });

    expect(logCalls).toHaveLength(1);
    const entry = JSON.parse(logCalls[0]);
    expect(entry.level).toBe("warn");
  });

  it("logs debug messages", () => {
    const logger = new Logger(mockCtx, "test-function", "trace-123");
    logger.debug("Detailed trace", { step: 1 });

    expect(logCalls).toHaveLength(1);
    const entry = JSON.parse(logCalls[0]);
    expect(entry.level).toBe("debug");
  });

  it("handles empty metadata", () => {
    const logger = new Logger(mockCtx, "test-function", "trace-123");
    logger.info("Simple message");

    expect(logCalls).toHaveLength(1);
    const entry = JSON.parse(logCalls[0]);
    expect(entry.message).toBe("Simple message");
  });

  it("handles error without metadata", () => {
    const logger = new Logger(mockCtx, "test-function", "trace-123");
    const error = new Error("Test error");

    logger.error("Failed", error);

    expect(logCalls).toHaveLength(1);
    const entry = JSON.parse(logCalls[0]);
    expect(entry.error_message).toBe("Test error");
  });
});

describe("extractTraceId", () => {
  it("prefers x-trace-id header", () => {
    const headers = new Map([
      ["x-trace-id", "custom-trace"],
      ["traceparent", "00-abc123-parent-01"],
    ]);

    expect(extractTraceId(headers)).toBe("custom-trace");
  });

  it("extracts trace id from traceparent", () => {
    const headers = new Map([["traceparent", "00-abc123def4567890abc123def4567890-parent-01"]]);
    expect(extractTraceId(headers)).toBe("abc123def4567890abc123def4567890");
  });

  it("falls back to x-ms-request-id", () => {
    const headers = new Map([["x-ms-request-id", "azure-request-id"]]);
    expect(extractTraceId(headers)).toBe("azure-request-id");
  });

  it("generates a UUID when no headers are present", () => {
    const headers = new Map<string, string>();
    const traceId = extractTraceId(headers);
    expect(traceId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("extractRequestMetadata", () => {
  it("extracts request metadata", () => {
    const request = {
      method: "POST",
      url: "https://example.com/api/converse?foo=bar",
      headers: new Map([
        ["content-length", "42"],
        ["user-agent", "vitest"],
      ]),
    };

    const metadata = extractRequestMetadata(request);
    expect(metadata.method).toBe("POST");
    expect(metadata.path).toBe("/api/converse");
    expect(metadata.query).toBe("?foo=bar");
    expect(metadata.content_length).toBe(42);
    expect(metadata.headers_count).toBe(2);
    expect(metadata.user_agent).toBe("vitest");
  });

  it("redacts secrets in query strings", () => {
    const request = {
      method: "GET",
      url: "https://example.com/api?token=secret&api_key=abc",
      headers: new Map<string, string>(),
    };

    const metadata = extractRequestMetadata(request);
    expect(metadata.query).toContain("token=****");
    expect(metadata.query).not.toContain("secret");
    expect(metadata.query).not.toContain("abc");
  });
});
