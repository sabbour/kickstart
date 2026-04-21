import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock setup (vi.mock factories run before variable declarations)
// ---------------------------------------------------------------------------

const { registeredHandlers, registerHttpHandler, mockGetRegistry, mockGetLoadErrors } = vi.hoisted(() => {
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
  const mockGetLoadErrors = vi.fn(() => []);
  return { registeredHandlers, registerHttpHandler, mockGetRegistry, mockGetLoadErrors };
});

vi.mock("@azure/functions", () => ({
  app: { http: registerHttpHandler },
}));

vi.mock("../startup/packs.js", () => ({
  getRegistry: mockGetRegistry,
  getLoadErrors: mockGetLoadErrors,
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
  trackException: vi.fn(),
  trackEvent: vi.fn(),
  trackTrace: vi.fn(),
  flushAppInsights: vi.fn().mockResolvedValue(undefined),
  initializeAppInsights: vi.fn(),
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
  mockGetLoadErrors.mockReturnValue([]);
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
// Degraded health check — non-core packs failed, registry still sealed
// ---------------------------------------------------------------------------

describe("GET /health (degraded — some packs failed)", () => {
  it("returns HTTP 200 with status:degraded when loadErrors is non-empty", async () => {
    mockGetLoadErrors.mockReturnValue([
      { packId: "azure", reason: "schema_validation" },
    ]);

    const res = (await healthHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };

    // HTTP 200 — not 503 (avoids Azure health probes taking down the SWA)
    expect(res.status).toBe(200);
    expect(res.jsonBody.status).toBe("degraded");
    expect(res.jsonBody.registry).toBe("ready");

    // loadErrors appears on the body with the sanitized shape
    const loadErrors = res.jsonBody.loadErrors as Array<{ packId: string; reason: string }>;
    expect(loadErrors).toHaveLength(1);
    expect(loadErrors[0]).toEqual({ packId: "azure", reason: "schema_validation" });

    // No raw error strings on an unauthenticated endpoint
    const body = JSON.stringify(res.jsonBody);
    expect(body).not.toContain("ZodError");
    expect(body).not.toContain("/home/");
    expect(body).not.toContain("wwwroot");
  });

  it("returns HTTP 200 with status:ok when loadErrors is empty", async () => {
    mockGetLoadErrors.mockReturnValue([]);

    const res = (await healthHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };

    expect(res.status).toBe(200);
    expect(res.jsonBody.status).toBe("ok");
    // loadErrors should not be on the body in the healthy case
    expect(res.jsonBody.loadErrors).toBeUndefined();
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

// ---------------------------------------------------------------------------
// Information-disclosure redaction (#927, #894)
// ---------------------------------------------------------------------------

describe("503 response redaction — no raw error details in unauthenticated responses", () => {
  const ALLOWED_KEYS = new Set(["status", "phase", "hint"]);

  function assert503Shape(
    body: Record<string, unknown>,
    rawMessage: string,
  ): void {
    // Only allow known safe fields
    for (const key of Object.keys(body)) {
      expect(ALLOWED_KEYS.has(key), `Unexpected key in 503 body: ${key}`).toBe(true);
    }
    // Raw error text must never appear in the serialised response
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain(rawMessage);
    // detail and message fields must be absent
    expect(body.detail).toBeUndefined();
    expect(body.message).toBeUndefined();
  }

  it("redacts filesystem paths from ERR_MODULE_NOT_FOUND errors", async () => {
    const rawMsg =
      "ERR_MODULE_NOT_FOUND: cannot find module '/home/user/kickstart/packages/pack-azure/dist/index.js'";
    mockGetRegistry.mockImplementation(() => {
      const err = new Error(rawMsg);
      (err as NodeJS.ErrnoException).code = "ERR_MODULE_NOT_FOUND";
      throw err;
    });

    const res = (await healthHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };

    expect(res.status).toBe(503);
    assert503Shape(res.jsonBody, "/home/user/kickstart");
    expect(res.jsonBody.phase).toBe("pack-import");
  });

  it("redacts endpoint URLs from Invalid URL errors", async () => {
    const rawMsg =
      "Invalid URL: https://abc-xyz-invalid-region.openai.azure.com/openai/deployments/gpt-4o";
    mockGetRegistry.mockImplementation(() => {
      throw new TypeError(rawMsg);
    });

    const res = (await healthHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };

    expect(res.status).toBe(503);
    assert503Shape(res.jsonBody, "abc-xyz-invalid-region.openai.azure.com");
  });

  it("redacts env-var names from AZURE_OPENAI misconfiguration errors", async () => {
    const rawMsg = "Missing required environment variable AZURE_OPENAI_API_KEY";
    mockGetRegistry.mockImplementation(() => {
      throw new Error(rawMsg);
    });

    const res = (await healthHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };

    expect(res.status).toBe(503);
    // phase is allowed to say "env-validation" (opaque category, no raw msg)
    expect(res.jsonBody.phase).toBe("env-validation");
    assert503Shape(res.jsonBody, rawMsg);
  });

  it("redacts pack-registry seal errors", async () => {
    const rawMsg = "Seal failed: duplicate pack id 'azure' registered at /opt/app/packs/azure.js";
    mockGetRegistry.mockImplementation(() => {
      throw new Error(rawMsg);
    });

    const res = (await healthHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };

    expect(res.status).toBe(503);
    assert503Shape(res.jsonBody, "/opt/app/packs/azure.js");
    expect(res.jsonBody.phase).toBe("registry-seal");
  });

  it("503 body has exactly status, phase, and hint — nothing else", async () => {
    mockGetRegistry.mockImplementation(() => {
      throw new Error("unexpected failure");
    });

    const res = (await healthHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };

    expect(res.status).toBe(503);
    expect(Object.keys(res.jsonBody).sort()).toEqual(["hint", "phase", "status"]);
  });
});

