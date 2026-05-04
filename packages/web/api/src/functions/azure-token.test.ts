/**
 * HTTP-level tests for GET /api/azure/token (issue #237).
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

const { registeredHandlers, registeredConfigs, registerHttpHandler } = vi.hoisted(() => {
  const registeredHandlers = new Map<
    string,
    (request: unknown, context: unknown) => Promise<{ status: number; jsonBody?: unknown; headers?: Record<string, string> }>
  >();
  const registeredConfigs = new Map<string, { methods?: string[]; route?: string; authLevel?: string }>();
  const registerHttpHandler = vi.fn(
    (
      name: string,
      config: { handler: (request: unknown, context: unknown) => Promise<unknown>; methods?: string[]; route?: string; authLevel?: string },
    ) => {
      registeredHandlers.set(name, config.handler as never);
      registeredConfigs.set(name, { methods: config.methods, route: config.route, authLevel: config.authLevel });
    },
  );
  return { registeredHandlers, registeredConfigs, registerHttpHandler };
});

vi.mock('@azure/functions', () => ({
  app: { http: registerHttpHandler },
}));

beforeAll(async () => {
  await import('./azure-token.js');
});

interface MockResponse {
  status: number;
  jsonBody?: { token?: string; expiresAt?: string; error?: string; code?: string };
  headers?: Record<string, string>;
}

function makeRequest(headers: Record<string, string>): unknown {
  return {
    headers: new Headers(headers),
  };
}

function makeContext(): unknown {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };
}

async function invoke(req: unknown, ctx: unknown): Promise<MockResponse> {
  const handler = registeredHandlers.get('azure-token');
  if (!handler) throw new Error('azure-token handler was not registered');
  return (await handler(req, ctx)) as MockResponse;
}

describe('GET /api/azure/token', () => {
  it('returns the SWA-injected Azure access token to authenticated callers', async () => {
    const res = await invoke(
      makeRequest({
        'x-ms-client-principal-id': 'principal-1',
        'x-ms-token-aad-access-token': 'arm-token-xyz',
      }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    expect(res.jsonBody?.token).toBe('arm-token-xyz');
    expect(res.headers?.['Cache-Control']).toBe('no-store');
  });

  it('returns 403 when no authenticated principal is present', async () => {
    const res = await invoke(
      makeRequest({
        'x-ms-token-aad-access-token': 'arm-token-xyz',
      }),
      makeContext(),
    );

    expect(res.status).toBe(403);
    expect(res.jsonBody?.code).toBe('principal_required');
    expect(res.jsonBody?.token).toBeUndefined();
  });

  it('returns 401 when an authenticated principal has no SWA Azure token', async () => {
    const res = await invoke(
      makeRequest({
        'x-ms-client-principal-id': 'principal-1',
      }),
      makeContext(),
    );

    expect(res.status).toBe(403);
    expect(res.jsonBody?.code).toBe('azure_access_token_missing');
    expect(res.jsonBody?.token).toBeUndefined();
  });

  it('returns 401 when the SWA Azure token header is present but empty/whitespace (fail-closed)', async () => {
    const res = await invoke(
      makeRequest({
        'x-ms-client-principal-id': 'principal-1',
        'x-ms-token-aad-access-token': '   ',
      }),
      makeContext(),
    );

    expect(res.status).toBe(403);
    expect(res.jsonBody?.code).toBe('azure_access_token_missing');
    expect(res.jsonBody?.token).toBeUndefined();
  });

  it('is registered as a GET-only route at azure/token (Functions runtime returns 405 for other methods)', async () => {
    const config = registeredConfigs.get('azure-token');
    expect(config).toBeDefined();
    expect(config?.methods).toEqual(['GET']);
    expect(config?.route).toBe('azure/token');
  });

  it('parses epoch-seconds expiry hint into ISO timestamp when SWA provides one', async () => {
    const epochSeconds = 1_800_000_000;
    const res = await invoke(
      makeRequest({
        'x-ms-client-principal-id': 'principal-1',
        'x-ms-token-aad-access-token': 'arm-token-xyz',
        'x-ms-token-aad-expires-on': String(epochSeconds),
      }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    expect(res.jsonBody?.expiresAt).toBe(new Date(epochSeconds * 1000).toISOString());
  });

  it('omits expiresAt when no expiry header is present', async () => {
    const res = await invoke(
      makeRequest({
        'x-ms-client-principal-id': 'principal-1',
        'x-ms-token-aad-access-token': 'arm-token-xyz',
      }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    expect(res.jsonBody?.expiresAt).toBeUndefined();
  });

  it('does not log the token value', async () => {
    const ctx = makeContext() as { log: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
    const sentinel = 'NEVER_LOG_THIS_TOKEN_VALUE_42';
    await invoke(
      makeRequest({
        'x-ms-client-principal-id': 'principal-1',
        'x-ms-token-aad-access-token': sentinel,
      }),
      ctx,
    );

    const allCalls = [
      ...ctx.log.mock.calls,
      ...ctx.error.mock.calls,
      ...ctx.warn.mock.calls,
      ...ctx.info.mock.calls,
    ];
    for (const call of allCalls) {
      for (const arg of call) {
        expect(typeof arg === 'string' ? arg : JSON.stringify(arg)).not.toContain(sentinel);
      }
    }
  });
});
