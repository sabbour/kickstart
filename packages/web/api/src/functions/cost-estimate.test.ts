import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession } from '../lib/session-store.js';

const registeredHandlers = new Map<string, (request: unknown, context: unknown) => Promise<unknown>>();
const registerHttpHandler = vi.fn((name: string, config: { handler: (request: unknown, context: unknown) => Promise<unknown> }) => {
  registeredHandlers.set(name, config.handler);
});

const checkRateLimit = vi.fn(() => ({ allowed: true, remaining: 11 }));
const resolveSessionCostEstimate = vi.fn();
const normalizeCostEstimateRequest = vi.fn((body: unknown) => body);

class MockCostEstimateRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 400, code = 'invalid_request') {
    super(message);
    this.name = 'CostEstimateRequestError';
    this.status = status;
    this.code = code;
  }
}

vi.mock('@azure/functions', () => ({
  app: {
    http: registerHttpHandler,
  },
}));

vi.mock('../lib/rate-limiter.js', () => ({
  checkRateLimit,
  rateLimitResponse: vi.fn((retryAfterMs: number) => ({
    status: 429,
    headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) },
    jsonBody: { error: 'Too many requests. Please try again later.' },
  })),
}));

vi.mock('../lib/cost-estimate.js', () => ({
  CostEstimateRequestError: MockCostEstimateRequestError,
  normalizeCostEstimateRequest,
  resolveSessionCostEstimate,
}));

let costEstimateHandler: (request: unknown, context: unknown) => Promise<unknown>;

beforeAll(async () => {
  await import('./cost-estimate.js');
  const handler = registeredHandlers.get('cost-estimate');
  if (!handler) {
    throw new Error('cost-estimate handler was not registered');
  }
  costEstimateHandler = handler;
});

beforeEach(() => {
  checkRateLimit.mockReset();
  checkRateLimit.mockReturnValue({ allowed: true, remaining: 11 });
  normalizeCostEstimateRequest.mockReset();
  normalizeCostEstimateRequest.mockImplementation((body: unknown) => body);
  resolveSessionCostEstimate.mockReset();
});

function createRequest(
  body: unknown,
  {
    sessionId,
    headers = {},
  }: {
    sessionId: string;
    headers?: Record<string, string>;
  },
): {
  params: { sessionId: string };
  headers: { get(name: string): string | undefined };
  json: () => Promise<unknown>;
} {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    params: { sessionId },
    headers: {
      get(name: string) {
        return normalizedHeaders.get(name.toLowerCase());
      },
    },
    json: async () => body,
  };
}

function createContext(): { log: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> } {
  return {
    log: vi.fn(),
    error: vi.fn(),
  };
}

describe('cost-estimate function', () => {
  it('returns 429 when the caller exceeds the rate limit', async () => {
    checkRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 1_500 });

    const session = createSession();
    const response = await costEstimateHandler(
      createRequest({}, { sessionId: session.state.sessionId }),
      createContext(),
    ) as { status: number; headers: Record<string, string> };

    expect(response.status).toBe(429);
    expect(response.headers['Retry-After']).toBe('2');
  });

  it('rejects requests for sessions owned by a different principal', async () => {
    const session = createSession('owner-1');

    const response = await costEstimateHandler(
      createRequest(
        { region: 'eastus', lineItems: [{ id: 'aks-control-plane', kind: 'aksAutomaticControlPlane' }] },
        {
          sessionId: session.state.sessionId,
          headers: { 'x-ms-client-principal-id': 'owner-2' },
        },
      ),
      createContext(),
    ) as { status: number; jsonBody: { code: string } };

    expect(response.status).toBe(403);
    expect(response.jsonBody.code).toBe('forbidden_session');
    expect(resolveSessionCostEstimate).not.toHaveBeenCalled();
  });

  it('normalizes the request, adopts the principal, and returns the resolved estimate', async () => {
    const session = createSession();
    resolveSessionCostEstimate.mockResolvedValue({
      resources: [{ name: 'AKS Automatic control plane', sku: 'Standard', monthlyEstimate: 116.8 }],
      monthlyEstimate: 116.8,
      currency: 'USD',
      source: 'live',
      cache: { status: 'miss' },
      fallback: { used: false },
      citation: 'Prices from Azure Retail Prices API (East US, consumption).',
    });

    const context = createContext();
    const body = {
      region: 'eastus',
      lineItems: [{ id: 'aks-control-plane', kind: 'aksAutomaticControlPlane' }],
    };

    const response = await costEstimateHandler(
      createRequest(body, {
        sessionId: session.state.sessionId,
        headers: { 'x-ms-client-principal-id': 'owner-1' },
      }),
      context,
    ) as { status: number; jsonBody: { monthlyEstimate: number } };

    expect(response.status).toBe(200);
    expect(response.jsonBody.monthlyEstimate).toBe(116.8);
    expect(session.principalId).toBe('owner-1');
    expect(normalizeCostEstimateRequest).toHaveBeenCalledWith(body);
    expect(resolveSessionCostEstimate).toHaveBeenCalledWith(session, body);
    expect(context.log).toHaveBeenCalledWith(expect.stringContaining(`session=${session.state.sessionId}`));
  });

  it('returns structured request errors from validation', async () => {
    const session = createSession('owner-1');
    normalizeCostEstimateRequest.mockImplementation(() => {
      throw new MockCostEstimateRequestError('Unsupported region.', 400, 'unsupported_region');
    });

    const response = await costEstimateHandler(
      createRequest(
        { region: 'centralus', lineItems: [{ id: 'aks-control-plane', kind: 'aksAutomaticControlPlane' }] },
        {
          sessionId: session.state.sessionId,
          headers: { 'x-ms-client-principal-id': 'owner-1' },
        },
      ),
      createContext(),
    ) as { status: number; jsonBody: { code: string; error: string } };

    expect(response.status).toBe(400);
    expect(response.jsonBody).toEqual({
      error: 'Unsupported region.',
      code: 'unsupported_region',
    });
  });
});
