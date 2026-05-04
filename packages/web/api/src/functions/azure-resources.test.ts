import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

function makeRequest(
  headers: Record<string, string> = {},
  params: Record<string, string> = {},
): unknown {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    params,
    headers: { get: (name: string) => h.get(name.toLowerCase()) ?? null },
  };
}

function makeContext(): unknown {
  return { log: vi.fn(), error: vi.fn(), warn: vi.fn() };
}

let handler: (request: unknown, context: unknown) => Promise<unknown>;

beforeAll(async () => {
  await import("./azure-resources.js");
  const h = registeredHandlers.get("azure-resources");
  if (!h) throw new Error("azure-resources handler not registered");
  handler = h;
});

beforeEach(() => {
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 29 });
  mockArmGetList.mockReset();
});

describe("GET /api/azure/subscriptions/{subId}/resources", () => {
  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 2_000 });
    const result = await handler(makeRequest(), makeContext()) as { status: number };
    expect(result.status).toBe(429);
  });

  it("returns 400 when subId is missing", async () => {
    const result = await handler(
      makeRequest(
        { "x-ms-client-principal-id": "user-1", "x-ms-token-aad-access-token": "tok" },
        { subId: "" },
      ),
      makeContext(),
    ) as { status: number; jsonBody: { code: string } };
    expect(result.status).toBe(400);
    expect(result.jsonBody.code).toBe("missing_subscription_id");
  });

  it("returns 401 when access token is missing", async () => {
    const result = await handler(
      makeRequest({ "x-ms-client-principal-id": "user-1" }, { subId: "sub-1" }),
      makeContext(),
    ) as { status: number; jsonBody: { code: string } };
    expect(result.status).toBe(403);
    expect(result.jsonBody.code).toBe("azure_access_token_missing");
  });

  it("returns 200 with typed value array on success", async () => {
    mockArmGetList.mockResolvedValue([
      {
        id: "/subscriptions/sub-1/resourceGroups/rg-a/providers/Microsoft.ContainerService/managedClusters/my-aks",
        name: "my-aks",
        type: "Microsoft.ContainerService/managedClusters",
        location: "eastus",
      },
    ]);

    const result = await handler(
      makeRequest(
        { "x-ms-client-principal-id": "user-1", "x-ms-token-aad-access-token": "tok" },
        { subId: "sub-1" },
      ),
      makeContext(),
    ) as { status: number; jsonBody: { value: unknown[] } };

    expect(result.status).toBe(200);
    expect(result.jsonBody.value).toHaveLength(1);
    expect((result.jsonBody.value[0] as { name: string }).name).toBe("my-aks");
  });

  it("calls ARM with correct resources path and api-version", async () => {
    mockArmGetList.mockResolvedValue([]);

    await handler(
      makeRequest(
        { "x-ms-client-principal-id": "user-1", "x-ms-token-aad-access-token": "tok" },
        { subId: "sub-1" },
      ),
      makeContext(),
    );

    expect(mockArmGetList).toHaveBeenCalledWith(
      "tok",
      "/subscriptions/sub-1/resources?api-version=2021-04-01",
    );
  });

  it("forwards ARM error status", async () => {
    const { AzureApiError } = await import("../lib/azure-errors.js");
    mockArmGetList.mockRejectedValue(
      new AzureApiError(429, "too_many_requests", "Throttled by ARM."),
    );

    const result = await handler(
      makeRequest(
        { "x-ms-client-principal-id": "user-1", "x-ms-token-aad-access-token": "tok" },
        { subId: "sub-1" },
      ),
      makeContext(),
    ) as { status: number; jsonBody: { code: string } };

    expect(result.status).toBe(429);
    expect(result.jsonBody.code).toBe("too_many_requests");
  });
});
