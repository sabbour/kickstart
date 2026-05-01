// @vitest-environment jsdom
/**
 * Tests for `armFetch` / `acquireArmToken` (issue #318 — Wave 1 of #237).
 *
 * Covers:
 *   - All four discriminated-union variants returned through `ArmFetchError`
 *     (auth-error, network-error, arm-error from ARM, arm-error from /token)
 *   - At-most-one 401-refresh-retry, including the
 *     "refresh-succeeded-but-second-call-still-401" case (Nibbler condition #4).
 *   - Memory-only token storage — `JSON.stringify(window).includes(token) === false`
 *     (Nibbler condition #5, exact form).
 *   - No `localStorage` / `sessionStorage` writes during a successful ARM call.
 *   - Default `api-version` injection parity with `BrowserAzureARMConnector`.
 *   - `Retry-After` honoured up to a 30s cap.
 *   - `fetchingTokenRef` deduplication of concurrent refreshes.
 *
 * Test infra: MSW (Mock Service Worker) handlers are registered against
 * absolute ARM URLs (`https://management.azure.com/...`), per the Wave-1
 * rewiring required by the issue.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';

import { armMswServer, armUrl, TOKEN_ENDPOINT } from '../../../__tests__/setup/arm-msw-server';
import {
  ArmFetchError,
  DEFAULT_ARM_API_VERSION,
  __resetArmTokenForTests,
  acquireArmToken,
  armFetch,
} from '../armFetch';

beforeAll(() => armMswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  armMswServer.resetHandlers();
  __resetArmTokenForTests();
  vi.useRealTimers();
});
afterAll(() => armMswServer.close());

beforeEach(() => {
  // Wipe any storage state so leak assertions can't be polluted by other suites.
  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    /* no-op in non-DOM contexts */
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Spy on storage.setItem so we can assert no writes happen during a call. */
function spyStorageWrites(): { local: ReturnType<typeof vi.spyOn>; session: ReturnType<typeof vi.spyOn> } {
  return {
    local: vi.spyOn(Storage.prototype, 'setItem'),
    session: vi.spyOn(Storage.prototype, 'setItem'),
  };
}

// ---------------------------------------------------------------------------
// Happy path & url construction
// ---------------------------------------------------------------------------

describe('armFetch — happy path', () => {
  it('issues calls to https://management.azure.com (absolute, never /api/arm-proxy)', async () => {
    let observedUrl: string | undefined;
    let observedAuth: string | null = null;

    armMswServer.use(
      http.get(armUrl('/subscriptions'), ({ request }) => {
        observedUrl = request.url;
        observedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ value: [{ subscriptionId: 'sub-1' }] });
      }),
    );

    const response = await armFetch('/subscriptions?api-version=2022-12-01');
    const body = (await response.json()) as { value: Array<{ subscriptionId: string }> };

    expect(response.ok).toBe(true);
    expect(body.value[0].subscriptionId).toBe('sub-1');
    expect(observedUrl).toBe('https://management.azure.com/subscriptions?api-version=2022-12-01');
    expect(observedAuth).toBe('Bearer msw-default-token');
  });

  it('injects DEFAULT_ARM_API_VERSION when caller omits api-version', async () => {
    const seen: string[] = [];
    armMswServer.use(
      http.get(armUrl('/subscriptions/sub-1/resourcegroups'), ({ request }) => {
        seen.push(request.url);
        return HttpResponse.json({ value: [] });
      }),
    );

    await armFetch('/subscriptions/sub-1/resourcegroups');

    expect(seen[0]).toBe(
      `https://management.azure.com/subscriptions/sub-1/resourcegroups?api-version=${DEFAULT_ARM_API_VERSION}`,
    );
  });

  it('preserves caller-supplied api-version (no double injection)', async () => {
    const seen: string[] = [];
    armMswServer.use(
      http.get(armUrl('/subscriptions'), ({ request }) => {
        seen.push(request.url);
        return HttpResponse.json({ value: [] });
      }),
    );

    await armFetch('/subscriptions?api-version=2024-01-01');
    expect(seen[0]).toBe('https://management.azure.com/subscriptions?api-version=2024-01-01');
    expect(seen[0]).not.toMatch(/api-version=.*api-version=/);
  });

  it('honours apiVersion: null to suppress injection', async () => {
    const seen: string[] = [];
    armMswServer.use(
      http.get(armUrl('/providers'), ({ request }) => {
        seen.push(request.url);
        return HttpResponse.json({});
      }),
    );

    await armFetch('/providers', { apiVersion: null });
    expect(seen[0]).toBe('https://management.azure.com/providers');
  });
});

// ---------------------------------------------------------------------------
// Error union — all four variants
// ---------------------------------------------------------------------------

describe('armFetch — discriminated error union', () => {
  it('throws auth-error when /api/azure/token returns 401', async () => {
    armMswServer.use(
      http.get(TOKEN_ENDPOINT, () =>
        HttpResponse.json({ error: 'Sign in required.' }, { status: 401 }),
      ),
    );

    await expect(armFetch('/subscriptions')).rejects.toMatchObject({
      kind: 'auth-error',
      status: 401,
    });
  });

  it('throws network-error when fetch itself rejects', async () => {
    // Stub fetch directly — MSW can't simulate a transport-level failure
    // before a Response exists. We restore in `afterEach` via vi.useRealTimers
    // / unstub in test teardown.
    const stub = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', stub);

    try {
      await expect(armFetch('/subscriptions')).rejects.toMatchObject({
        kind: 'network-error',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('throws arm-error with code/message extracted from ARM error body', async () => {
    armMswServer.use(
      http.get(armUrl('/subscriptions/missing'), () =>
        HttpResponse.json(
          { error: { code: 'SubscriptionNotFound', message: 'No such subscription.' } },
          { status: 404 },
        ),
      ),
    );

    await expect(armFetch('/subscriptions/missing')).rejects.toMatchObject({
      kind: 'arm-error',
      status: 404,
      code: 'SubscriptionNotFound',
      message: 'No such subscription.',
    });
  });

  it('throws arm-error when /api/azure/token returns 500 (non-auth failure)', async () => {
    armMswServer.use(
      http.get(TOKEN_ENDPOINT, () =>
        HttpResponse.json({ error: 'token endpoint blew up', code: 'token_failure' }, { status: 500 }),
      ),
    );

    const error = await armFetch('/subscriptions').catch((e) => e);
    expect(error).toBeInstanceOf(ArmFetchError);
    expect(error).toMatchObject({ kind: 'arm-error', status: 500, code: 'token_failure' });
  });
});

// ---------------------------------------------------------------------------
// Retry-once-on-401 — Nibbler condition #4
// ---------------------------------------------------------------------------

describe('armFetch — at-most-one 401-refresh-retry', () => {
  it('refreshes the token once on 401 and succeeds on retry', async () => {
    const tokens = ['stale-token', 'fresh-token'];
    const tokenCalls: number[] = [];
    let armCallCount = 0;

    armMswServer.use(
      http.get(TOKEN_ENDPOINT, () => {
        const t = tokens.shift() ?? 'extra-token';
        tokenCalls.push(tokenCalls.length);
        return HttpResponse.json({ token: t });
      }),
      http.get(armUrl('/subscriptions'), ({ request }) => {
        armCallCount += 1;
        const auth = request.headers.get('Authorization');
        if (auth === 'Bearer stale-token') {
          return HttpResponse.json({ error: { code: 'ExpiredToken', message: 'token expired' } }, { status: 401 });
        }
        return HttpResponse.json({ value: [] });
      }),
    );

    const response = await armFetch('/subscriptions');

    expect(response.ok).toBe(true);
    expect(armCallCount).toBe(2);
    expect(tokenCalls.length).toBe(2);
  });

  it('Nibbler #4: refresh succeeded but second ARM call still 401 → auth-error (no third attempt)', async () => {
    let tokenCalls = 0;
    let armCallCount = 0;

    armMswServer.use(
      http.get(TOKEN_ENDPOINT, () => {
        tokenCalls += 1;
        return HttpResponse.json({ token: `tok-${tokenCalls}` });
      }),
      http.get(armUrl('/subscriptions'), () => {
        armCallCount += 1;
        return HttpResponse.json(
          { error: { code: 'AuthenticationFailed', message: 'still no.' } },
          { status: 401 },
        );
      }),
    );

    await expect(armFetch('/subscriptions')).rejects.toMatchObject({
      kind: 'auth-error',
      status: 401,
    });

    // Exactly one retry — never a third ARM call.
    expect(armCallCount).toBe(2);
    // Two token mints: original + one refresh.
    expect(tokenCalls).toBe(2);
  });

  it('does not retry on 403 (only 401 triggers the refresh path)', async () => {
    let armCallCount = 0;
    armMswServer.use(
      http.get(armUrl('/subscriptions'), () => {
        armCallCount += 1;
        return HttpResponse.json(
          { error: { code: 'Forbidden', message: 'no perms' } },
          { status: 403 },
        );
      }),
    );

    await expect(armFetch('/subscriptions')).rejects.toMatchObject({
      kind: 'auth-error',
      status: 403,
    });
    expect(armCallCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Memory-only token (Zapp condition)
// ---------------------------------------------------------------------------

describe('armFetch — memory-only token storage (Zapp condition)', () => {
  it('Nibbler #5: JSON.stringify(window).includes(token) === false', async () => {
    armMswServer.use(
      http.get(TOKEN_ENDPOINT, () =>
        HttpResponse.json({ token: 'super-secret-token-abc-xyz' }),
      ),
      http.get(armUrl('/subscriptions'), () => HttpResponse.json({ value: [] })),
    );

    await armFetch('/subscriptions');

    // Exact form mandated by the issue — DO NOT soften.
    // (jsdom's `window` has cycles, so we use a circular-safe replacer; the
    // serialization still walks every enumerable property that *could* hold
    // the token, satisfying the leak check.)
    const seen = new WeakSet<object>();
    const dump = JSON.stringify(window, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return undefined;
        seen.add(value);
      }
      return value;
    });
    expect(dump.includes('super-secret-token-abc-xyz')).toBe(false);
  });

  it('does not write the token to localStorage or sessionStorage', async () => {
    const writes = spyStorageWrites();

    armMswServer.use(
      http.get(TOKEN_ENDPOINT, () => HttpResponse.json({ token: 'no-leak-please' })),
      http.get(armUrl('/subscriptions'), () => HttpResponse.json({ value: [] })),
    );

    await armFetch('/subscriptions');

    // Whatever the test framework writes itself (e.g. for diagnostics) must
    // not contain the token. Easier guard: assert *no* setItem call carried
    // the token value.
    for (const call of writes.local.mock.calls) {
      expect(String(call[1])).not.toContain('no-leak-please');
    }
    for (const call of writes.session.mock.calls) {
      expect(String(call[1])).not.toContain('no-leak-please');
    }
    // And of course the storage itself is empty of the secret.
    expect(window.localStorage.getItem('armToken')).toBeNull();
    expect(window.sessionStorage.getItem('armToken')).toBeNull();
  });

  it('does not set the token as a cookie', async () => {
    armMswServer.use(
      http.get(TOKEN_ENDPOINT, () => HttpResponse.json({ token: 'cookie-leak-canary' })),
      http.get(armUrl('/subscriptions'), () => HttpResponse.json({ value: [] })),
    );

    await armFetch('/subscriptions');
    expect(document.cookie).not.toContain('cookie-leak-canary');
  });
});

// ---------------------------------------------------------------------------
// fetchingTokenRef dedup
// ---------------------------------------------------------------------------

describe('acquireArmToken — concurrent refresh deduplication', () => {
  it('shares a single in-flight /api/azure/token request across concurrent callers', async () => {
    let tokenCalls = 0;
    armMswServer.use(
      http.get(TOKEN_ENDPOINT, async () => {
        tokenCalls += 1;
        await delay(20);
        return HttpResponse.json({ token: 'shared-token' });
      }),
    );

    const [a, b, c] = await Promise.all([
      acquireArmToken(),
      acquireArmToken(),
      acquireArmToken(),
    ]);

    expect(a).toBe('shared-token');
    expect(b).toBe('shared-token');
    expect(c).toBe('shared-token');
    expect(tokenCalls).toBe(1);
  });

  it('clears fetchingTokenRef on rejection so the next caller can retry', async () => {
    let tokenCalls = 0;
    armMswServer.use(
      http.get(TOKEN_ENDPOINT, () => {
        tokenCalls += 1;
        if (tokenCalls === 1) return HttpResponse.json({ error: 'boom' }, { status: 500 });
        return HttpResponse.json({ token: 'recovered-token' });
      }),
    );

    await expect(acquireArmToken()).rejects.toMatchObject({ kind: 'arm-error' });
    // Second attempt must be allowed to fetch — ref was cleared in finally.
    await expect(acquireArmToken()).resolves.toBe('recovered-token');
    expect(tokenCalls).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Retry-After honouring
// ---------------------------------------------------------------------------

describe('armFetch — Retry-After', () => {
  it('honours Retry-After up to a 30s cap', async () => {
    armMswServer.use(
      http.get(armUrl('/throttled'), () =>
        HttpResponse.json(
          { error: { code: 'TooManyRequests', message: 'slow down' } },
          { status: 429, headers: { 'Retry-After': '9999' } },
        ),
      ),
    );

    const sleeps: number[] = [];
    const realSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(
      ((cb: () => void, ms?: number) => {
        sleeps.push(ms ?? 0);
        // Fire immediately so the test doesn't actually wait.
        return realSetTimeout(cb, 0);
      }) as unknown as typeof setTimeout,
    );

    try {
      await expect(armFetch('/throttled')).rejects.toMatchObject({
        kind: 'arm-error',
        status: 429,
      });
    } finally {
      vi.restoreAllMocks();
    }

    // Cap = 30s = 30_000ms. Header asked for 9999s — must be clamped.
    expect(sleeps).toContain(30_000);
  });
});
