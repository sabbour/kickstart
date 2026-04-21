import { describe, it, expect, vi, beforeEach } from "vitest";
import { Logger, redactSecrets, extractTraceId, extractRequestMetadata } from "./logger.js";
import type { InvocationContext } from "@azure/functions";

describe("redactSecrets", () => {
  it("redacts JWT tokens", () => {
    const input = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const result = redactSecrets(input) as string;
    expect(result).toContain("Bearer ****");
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
    expect(result).toContain("?api_key=****");
    expect(result).toContain("?code=****");
    expect(result).toContain("?token=****");
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
    const input = 'Error calling API: GET /blobs?api-key=secret123&version=2024 returned 401';
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
    const input = [
      { secret: "value1" },
      { secret: "value2" },
    ];
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

  it("logs errors with stack traces", () => {
    const logger = new Logger(mockCtx, "test-function", "trace-123");
    const error = new Error("Test error");
    logger.error("Failed", error, { context: "test" });

    expect(logCalls).toHaveLength(1);
    const entry = JSON.parse(logCalls[0]);
    expect(entry.level).toBe("error");
    expect(entry.error_message).toBe("Test error");
    expect(entry.stack_trace).toContain("Error: Test error");
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

  it("creates child loggers with session context", () => {
    const logger = new Logger(mockCtx, "test-function", "trace-123");
    const childLogger = logger.withContext("sess-456");

    childLogger.info("Child message");

    expect(logCalls).toHaveLength(1);
    const entry = JSON.parse(logCalls[0]);
    expect(entry.session_id).toBe("sess-456");
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
    const error = new Error("Test");
    logger.error("Failed", error);

    expect(logCalls).toHaveLength(1);
    const entry = JSON.parse(logCalls[0]);
    expect(entry.error_message).toBe("Test");
  });

  it("includes timestamp in ISO format", () => {
    const before = new Date().toISOString();
    const logger = new Logger(mockCtx, "test-function", "trace-123");
    logger.info("Test");
    const after = new Date().toISOString();

    const entry = JSON.parse(logCalls[0]);
    const timestamp = entry.timestamp;
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(timestamp >= before && timestamp <= after).toBe(true);
  });
});

describe("extractTraceId", () => {
  it("extracts custom x-trace-id header", () => {
    const headers = new Map([["x-trace-id", "custom-trace-123"]]);
    const traceId = extractTraceId(headers);
    expect(traceId).toBe("custom-trace-123");
  });

  it("extracts trace ID from W3C traceparent header", () => {
    const headers = new Map([
      ["traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"],
    ]);
    const traceId = extractTraceId(headers);
    expect(traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  });

  it("extracts x-ms-request-id as fallback", () => {
    const headers = new Map([["x-ms-request-id", "azure-request-123"]]);
    const traceId = extractTraceId(headers);
    expect(traceId).toBe("azure-request-123");
  });

  it("generates UUID when no trace ID header present", () => {
    const headers = new Map();
    const traceId = extractTraceId(headers);
    expect(traceId).toMatch(/^[a-f0-9\-]{36}$/);
  });

  it("prefers x-trace-id over other headers", () => {
    const headers = new Map([
      ["x-trace-id", "custom-123"],
      ["traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"],
      ["x-ms-request-id", "azure-123"],
    ]);
    const traceId = extractTraceId(headers);
    expect(traceId).toBe("custom-123");
  });
});

describe("extractRequestMetadata", () => {
  it("extracts method and path", () => {
    const request = {
      method: "POST",
      url: "http://localhost/api/converse",
      headers: new Map(),
    };
    const metadata = extractRequestMetadata(request);
    expect(metadata.method).toBe("POST");
    expect(metadata.path).toBe("/api/converse");
  });

  it("extracts content length", () => {
    const request = {
      method: "POST",
      url: "http://localhost/api/converse",
      headers: new Map([["content-length", "1024"]]),
    };
    const metadata = extractRequestMetadata(request);
    expect(metadata.content_length).toBe(1024);
  });

  it("extracts user agent", () => {
    const request = {
      method: "GET",
      url: "http://localhost/health",
      headers: new Map([["user-agent", "Mozilla/5.0"]]),
    };
    const metadata = extractRequestMetadata(request);
    expect(metadata.user_agent).toBe("Mozilla/5.0");
  });

  it("counts headers", () => {
    const request = {
      method: "GET",
      url: "http://localhost/health",
      headers: new Map([
        ["user-agent", "Mozilla/5.0"],
        ["accept", "application/json"],
      ]),
    };
    const metadata = extractRequestMetadata(request);
    expect(metadata.headers_count).toBe(2);
  });

  it("handles missing URL", () => {
    const request = {
      method: "GET",
      headers: new Map(),
    };
    const metadata = extractRequestMetadata(request);
    expect(metadata.method).toBe("GET");
    expect(metadata.path).toBeUndefined();
  });

  it("extracts query string", () => {
    const request = {
      method: "GET",
      url: "http://localhost/api/search?q=test&limit=10",
      headers: new Map(),
    };
    const metadata = extractRequestMetadata(request);
    expect(metadata.query).toContain("q=test");
  });

  it("redacts api_key from query string", () => {
    const request = {
      method: "GET",
      url: "http://localhost/api/search?api_key=sk-secret123&q=test",
      headers: new Map(),
    };
    const metadata = extractRequestMetadata(request);
    expect(metadata.query).toContain("****");
    expect(metadata.query).not.toContain("sk-secret123");
    expect(metadata.query).toContain("q=test");
  });

  it("redacts code from query string", () => {
    const request = {
      method: "GET",
      url: "http://localhost/callback?code=auth_code_123&state=xyz",
      headers: new Map(),
    };
    const metadata = extractRequestMetadata(request);
    expect(metadata.query).toContain("code=****");
    expect(metadata.query).not.toContain("auth_code_123");
    expect(metadata.query).toContain("state=xyz");
  });

  it("redacts token from query string", () => {
    const request = {
      method: "GET",
      url: "http://localhost/api?token=eyJhbGc&version=1",
      headers: new Map(),
    };
    const metadata = extractRequestMetadata(request);
    expect(metadata.query).toContain("token=****");
    expect(metadata.query).not.toContain("eyJhbGc");
  });

  it("redacts multiple secret params in query string", () => {
    const request = {
      method: "GET",
      url: "http://localhost/sync?api_key=key123&token=token456&secret=sec789",
      headers: new Map(),
    };
    const metadata = extractRequestMetadata(request);
    expect(metadata.query).not.toContain("key123");
    expect(metadata.query).not.toContain("token456");
    expect(metadata.query).not.toContain("sec789");
    expect(metadata.query).toContain("api_key=****");
    expect(metadata.query).toContain("token=****");
    expect(metadata.query).toContain("secret=****");
  });
});
