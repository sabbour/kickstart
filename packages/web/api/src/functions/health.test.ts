import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock setup (vi.mock factories run before variable declarations)
// ---------------------------------------------------------------------------

const { registeredHandlers, registerHttpHandler, mockGetRegistry } = vi.hoisted(() => {
  const registeredHandlers = new Map<
    string,
    (request: unknown, context: unknown) => Promise<unknown>
  >();
  const registerHttpHandler = vi.fn(
    (
      name: string,
      config: { handler: (request: unknown, context: unknown) => Promise<unknown> },
    ) => {
      registeredHandlers.set(name, config.handler);
    },
  );
  const mockGetRegistry = vi.fn();
  return { registeredHandlers, registerHttpHandler, mockGetRegistry };
});

vi.mock("@azure/functions", () => ({
  app: { http: registerHttpHandler },
}));

vi.mock("../startup/packs.js", () => ({
  getRegistry: mockGetRegistry,
}));

vi.mock("../lib/logger.js", () => ({
  Logger: class {
    withContext() { return this; }
    info() {}
    error() {}
  },
  extractTraceId: vi.fn(() => "trace-id"),
  extractRequestMetadata: vi.fn(() => ({})),
}));

vi.mock("../lib/appinsights.js", () => ({
  getAppInsightsClient: vi.fn(() => ({
    trackEvent: vi.fn(),
    trackException: vi.fn(),
  })),
}));

vi.mock("../telemetry/sanitize-error.js", () => ({
  sanitizeError: vi.fn((err: unknown) =>
    err instanceof Error ? err : new Error(String(err)),
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(queryParams: Record<string, string> = {}): unknown {
  const params = new URLSearchParams(queryParams);
  return {
    query: {
      get: (key: string) => params.get(key),
    },
    headers: { get: () => null },
    url: "https://example.com/api/health",
    method: "GET",
  };
}

function makeContext(): unknown {
  return { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let healthHandler: (request: unknown, context: unknown) => Promise<unknown>;
let resetLlmCache: () => void;

beforeAll(async () => {
  const mod = await import("./health.js");
  resetLlmCache = mod.resetLlmCache;

  const handler = registeredHandlers.get("health");
  if (!handler) throw new Error("health handler not registered");
  healthHandler = handler;
});

beforeEach(() => {
  mockGetRegistry.mockReturnValue({});
  resetLlmCache?.();

  vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://aoai.example.com");
  vi.stubEnv("AZURE_OPENAI_API_KEY", "test-key");
  vi.stubEnv("KICKSTART_CHAT_MODEL", "gpt-test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Default (shallow) health check
// ---------------------------------------------------------------------------

describe("GET /health (no deep param)", () => {
  it("returns 200 ok with registry:ready", async () => {
    const res = (await healthHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };
    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({ status: "ok", registry: "ready" });
    expect(res.jsonBody.llm).toBeUndefined();
  });

  it("returns 503 when registry throws", async () => {
    mockGetRegistry.mockImplementation(() => {
      throw new Error("seal failed");
    });
    const res = (await healthHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };
    expect(res.status).toBe(503);
    expect(res.jsonBody).toMatchObject({ status: "error" });
  });
});

// ---------------------------------------------------------------------------
// Deep health check — LLM probe
// ---------------------------------------------------------------------------

describe("GET /health?deep=1", () => {
  it("happy path: returns 200 with llm.ok true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "hi" }, finish_reason: "stop" }],
          usage: {},
        }),
      }),
    );

    const res = (await healthHandler(
      makeRequest({ deep: "1" }),
      makeContext(),
    )) as { status: number; jsonBody: Record<string, unknown> };

    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({
      status: "ok",
      registry: "ready",
      llm: { ok: true, model: "gpt-test" },
    });
    const llm = res.jsonBody.llm as Record<string, unknown>;
    expect(typeof llm.latencyMs).toBe("number");
    expect(llm.errorCode).toBeUndefined();
  });

  it("AOAI 404: returns 503 with llm.errorCode 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "deployment not found",
      }),
    );

    const res = (await healthHandler(
      makeRequest({ deep: "1" }),
      makeContext(),
    )) as { status: number; jsonBody: Record<string, unknown> };

    expect(res.status).toBe(503);
    const llm = res.jsonBody.llm as Record<string, unknown>;
    expect(llm.ok).toBe(false);
    expect(llm.errorCode).toBe(404);
    // Raw error body must NOT be surfaced
    expect(JSON.stringify(res.jsonBody)).not.toContain("deployment not found");
  });

  it("timeout: returns 503 with llm.errorCode 'timeout'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementationOnce(() => {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      }),
    );

    const res = (await healthHandler(
      makeRequest({ deep: "1" }),
      makeContext(),
    )) as { status: number; jsonBody: Record<string, unknown> };

    expect(res.status).toBe(503);
    const llm = res.jsonBody.llm as Record<string, unknown>;
    expect(llm.ok).toBe(false);
    expect(llm.errorCode).toBe("timeout");
  });

  it("cache hit: second deep probe within TTL returns cached:true without extra fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "hi" }, finish_reason: "stop" }],
        usage: {},
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    // First call — populates cache
    await healthHandler(makeRequest({ deep: "1" }), makeContext());
    // Second call — should hit cache
    const res2 = (await healthHandler(
      makeRequest({ deep: "1" }),
      makeContext(),
    )) as { status: number; jsonBody: Record<string, unknown> };

    // fetch should have been called only once across both requests
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const llm = res2.jsonBody.llm as Record<string, unknown>;
    expect(llm.ok).toBe(true);
    expect(llm.cached).toBe(true);
  });
});

