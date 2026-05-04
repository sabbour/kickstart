import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock setup — must run before module imports
// ---------------------------------------------------------------------------

const { registeredHandlers, registerHttpHandler } = vi.hoisted(() => {
  const registeredHandlers = new Map<
    string,
    (request: unknown, context: unknown) => Promise<unknown>
  >();
  const registerHttpHandler = vi.fn(
    (name: string, config: { handler: (request: unknown, context: unknown) => Promise<unknown> }) => {
      registeredHandlers.set(name, config.handler);
    },
  );
  return { registeredHandlers, registerHttpHandler };
});

const mockArmGetList = vi.fn();
const mockCheckRateLimit = vi.fn(() => ({ allowed: true, remaining: 29 }));

vi.mock("@azure/functions", () => ({ app: { http: registerHttpHandler } }));

vi.mock("../lib/arm-client.js", () => ({ armGetList: mockArmGetList }));

vi.mock("../lib/rate-limiter.js", () => ({
  checkRateLimit: mockCheckRateLimit,
  rateLimitResponse: vi.fn((retryAfterMs: number) => ({
    status: 429,
    headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
    jsonBody: { error: "Too many requests. Please try again later." },
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(headers: Record<string, string> = {}): unknown {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    params: {},
    headers: { get: (name: string) => h.get(name.toLowerCase()) ?? null },
  };
}

function makeContext(): unknown {
  return { log: vi.fn(), error: vi.fn(), warn: vi.fn() };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let handler: (request: unknown, context: unknown) => Promise<unknown>;

beforeAll(async () => {
  await import("./azure-subscriptions.js");
  const h = registeredHandlers.get("azure-subscriptions");
  if (!h) throw new Error("azure-subscriptions handler not registered");
  handler = h;
});

beforeEach(() => {
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 29 });
  mockArmGetList.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/azure/subscriptions", () => {
  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 2_000 });

    const result = await handler(makeRequest(), makeContext()) as { status: number };
    expect(result.status).toBe(429);
  });

  it("returns 403 when x-ms-client-principal-id is missing", async () => {
    const result = await handler(makeRequest(), makeContext()) as { status: number; jsonBody: { code: string } };
    expect(result.status).toBe(403);
    expect(result.jsonBody.code).toBe("principal_required");
  });

  it("returns 401 when x-ms-token-aad-access-token is missing", async () => {
    const result = await handler(
      makeRequest({ "x-ms-client-principal-id": "user-1" }),
      makeContext(),
    ) as { status: number; jsonBody: { code: string } };
    expect(result.status).toBe(403);
    expect(result.jsonBody.code).toBe("azure_access_token_missing");
  });

  it("returns 200 with typed value array on success", async () => {
    mockArmGetList.mockResolvedValue([
      { subscriptionId: "sub-1", displayName: "My Sub", state: "Enabled", tenantId: "tenant-1" },
    ]);

    const result = await handler(
      makeRequest({
        "x-ms-client-principal-id": "user-1",
        "x-ms-token-aad-access-token": "my-token",
      }),
      makeContext(),
    ) as { status: number; jsonBody: { value: unknown[] } };

    expect(result.status).toBe(200);
    expect(Array.isArray(result.jsonBody.value)).toBe(true);
    expect(result.jsonBody.value).toHaveLength(1);
    expect((result.jsonBody.value[0] as { subscriptionId: string }).subscriptionId).toBe("sub-1");
  });

  it("calls ARM with the correct subscriptions path", async () => {
    mockArmGetList.mockResolvedValue([]);

    await handler(
      makeRequest({
        "x-ms-client-principal-id": "user-1",
        "x-ms-token-aad-access-token": "my-token",
      }),
      makeContext(),
    );

    expect(mockArmGetList).toHaveBeenCalledWith(
      "my-token",
      "/subscriptions?api-version=2022-12-01",
    );
  });

  it("forwards ARM error status when ARM call fails", async () => {
    const { AzureApiError } = await import("../lib/azure-errors.js");
    mockArmGetList.mockRejectedValue(
      new AzureApiError(403, "authorization_failed", "The client does not have authorization."),
    );

    const result = await handler(
      makeRequest({
        "x-ms-client-principal-id": "user-1",
        "x-ms-token-aad-access-token": "my-token",
      }),
      makeContext(),
    ) as { status: number; jsonBody: { code: string } };

    expect(result.status).toBe(403);
    expect(result.jsonBody.code).toBe("authorization_failed");
  });
});
