// @vitest-environment jsdom
/**
 * Tests for the browser-side ARM client (issue #237 / DP #194).
 *
 * Covers Nibbler's PR-1 enforcement conditions:
 *   1. Memory-only token storage (no localStorage / sessionStorage / IndexedDB / cookies).
 *   4. Full 401-refresh-retry test coverage (at-most-one retry).
 *   5. Token absence from any persistent storage after a session.
 *
 * The test stubs `globalThis.fetch` and asserts requests are made against
 * the absolute `https://management.azure.com` origin (not a relative path
 * routed through the deprecated /api/arm-proxy).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  armRequest,
  armList,
  armFetchRaw,
  clearTokenCache,
  isTokenCached,
} from '../services/arm-client';

interface FetchCall {
  url: string;
  init: RequestInit;
}

function captureFetch(impl: (call: FetchCall, callIndex: number) => Response | Promise<Response>): {
  fn: ReturnType<typeof vi.fn>;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fn = vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const idx = calls.length;
    calls.push({ url, init });
    return impl({ url, init }, idx);
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}

function tokenResponse(token: string): Response {
  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  clearTokenCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearTokenCache();
});

describe('browser arm-client', () => {
  it('issues ARM calls directly to https://management.azure.com (not /api/arm-proxy)', async () => {
    const { calls } = captureFetch((call) => {
      if (call.url === '/api/azure/token') return tokenResponse('tok-1');
      return new Response(JSON.stringify({ value: [{ subscriptionId: 'sub-1' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await armList<{ subscriptionId: string }>(
      '/subscriptions?api-version=2022-12-01',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([{ subscriptionId: 'sub-1' }]);
    }
    expect(calls[0].url).toBe('/api/azure/token');
    expect(calls[1].url).toBe('https://management.azure.com/subscriptions?api-version=2022-12-01');
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
    // Critical: no /api/arm-proxy call.
    expect(calls.some((c) => c.url.includes('/api/arm-proxy'))).toBe(false);
  });

  it('refreshes the token and retries exactly once on a 401 from ARM', async () => {
    let tokenFetches = 0;
    const { calls } = captureFetch((call) => {
      if (call.url === '/api/azure/token') {
        tokenFetches += 1;
        return tokenResponse(`tok-${tokenFetches}`);
      }
      // First ARM call → 401, second ARM call (with refreshed token) → 200.
      const armCallIndex = calls.filter((c) => c.url.startsWith('https://management.azure.com')).length;
      if (armCallIndex === 1) {
        return new Response(JSON.stringify({ error: { code: 'ExpiredToken', message: 'Token expired.' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ value: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await armRequest({
      method: 'GET',
      path: '/subscriptions?api-version=2022-12-01',
    });

    expect(result.ok).toBe(true);
    expect(tokenFetches).toBe(2); // initial + one refresh
    const armCalls = calls.filter((c) => c.url.startsWith('https://management.azure.com'));
    expect(armCalls).toHaveLength(2); // original + retry
    expect((armCalls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
    expect((armCalls[1].init.headers as Record<string, string>).Authorization).toBe('Bearer tok-2');
  });

  it('surfaces auth-error when ARM keeps returning 401 even after one retry (no second retry)', async () => {
    let tokenFetches = 0;
    const { calls } = captureFetch((call) => {
      if (call.url === '/api/azure/token') {
        tokenFetches += 1;
        return tokenResponse(`tok-${tokenFetches}`);
      }
      return new Response(JSON.stringify({ error: { code: 'InvalidToken', message: 'Bad token.' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await armRequest({ method: 'GET', path: '/subscriptions' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('auth-error');
      if (result.error.kind === 'auth-error') {
        expect(result.error.status).toBe(401);
      }
    }
    // At-most-one retry: ARM must be called exactly twice.
    const armCalls = calls.filter((c) => c.url.startsWith('https://management.azure.com'));
    expect(armCalls).toHaveLength(2);
    expect(tokenFetches).toBe(2);
  });

  it('returns auth-error (without calling ARM) when /api/azure/token returns 401', async () => {
    const { calls } = captureFetch((call) => {
      if (call.url === '/api/azure/token') {
        return new Response(JSON.stringify({ error: 'Sign in.', code: 'principal_required' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error('ARM should not be reached when token endpoint fails');
    });

    const result = await armRequest({ method: 'GET', path: '/subscriptions' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('auth-error');
    expect(calls.every((c) => c.url === '/api/azure/token')).toBe(true);
  });

  it('classifies non-401 ARM failures as arm-error with the upstream code preserved', async () => {
    captureFetch((call) => {
      if (call.url === '/api/azure/token') return tokenResponse('tok-1');
      return new Response(
        JSON.stringify({ error: { code: 'ResourceGroupNotFound', message: 'Not found.' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const result = await armRequest({ method: 'GET', path: '/subscriptions/x/resourcegroups/y' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('arm-error');
      if (result.error.kind === 'arm-error') {
        expect(result.error.status).toBe(404);
        expect(result.error.code).toBe('ResourceGroupNotFound');
      }
    }
  });

  it('classifies fetch failures as network-error (and never throws)', async () => {
    captureFetch((call) => {
      if (call.url === '/api/azure/token') return tokenResponse('tok-1');
      throw new TypeError('Failed to fetch');
    });

    const result = await armRequest({ method: 'GET', path: '/subscriptions' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('network-error');
  });

  it('reuses the cached token on subsequent calls (no /api/azure/token round-trip)', async () => {
    let tokenFetches = 0;
    captureFetch((call) => {
      if (call.url === '/api/azure/token') {
        tokenFetches += 1;
        return tokenResponse('tok-cached');
      }
      return new Response(JSON.stringify({ value: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await armList('/subscriptions');
    await armList('/subscriptions');
    await armList('/subscriptions');

    expect(tokenFetches).toBe(1);
  });

  it('armFetchRaw returns the raw ARM Response for legacy callers', async () => {
    captureFetch((call) => {
      if (call.url === '/api/azure/token') return tokenResponse('tok-1');
      return new Response(JSON.stringify({ value: ['ok'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const response = await armFetchRaw('GET', '/subscriptions?api-version=2022-12-01');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ value: ['ok'] });
  });
});

// ---------------------------------------------------------------------------
// Token storage assertions (Zapp / Nibbler condition #5)
// ---------------------------------------------------------------------------

describe('arm-client token storage policy', () => {
  it('never writes the token to localStorage / sessionStorage / cookies / IndexedDB', async () => {
    captureFetch((call) => {
      if (call.url === '/api/azure/token') {
        return tokenResponse('SECRET-TOKEN-VALUE-DO-NOT-LEAK');
      }
      return new Response(JSON.stringify({ value: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    // Spy on every persistent storage write API a browser exposes.
    const localSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    const cookieSpy = vi.spyOn(document, 'cookie', 'set');
    const idbOpenSpy = globalThis.indexedDB
      ? vi.spyOn(globalThis.indexedDB, 'open')
      : undefined;

    await armList('/subscriptions');
    expect(isTokenCached()).toBe(true);

    // No persistent-storage API was invoked at all by the client.
    expect(localSetSpy).not.toHaveBeenCalled();
    expect(cookieSpy).not.toHaveBeenCalled();
    if (idbOpenSpy) expect(idbOpenSpy).not.toHaveBeenCalled();

    // Belt-and-braces: scan the actual storage backends for the token value.
    const sentinel = 'SECRET-TOKEN-VALUE-DO-NOT-LEAK';
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)!;
      expect(localStorage.getItem(k) ?? '').not.toContain(sentinel);
    }
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i)!;
      expect(sessionStorage.getItem(k) ?? '').not.toContain(sentinel);
    }
    expect(document.cookie).not.toContain(sentinel);

    localSetSpy.mockRestore();
    cookieSpy.mockRestore();
    idbOpenSpy?.mockRestore();
  });
});
