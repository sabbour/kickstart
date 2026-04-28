/**
 * Browser-side ARM client (issue #237 / DP #194 — Option A2, PR-1).
 *
 * Replaces the legacy /api/arm-proxy/* round-trip with direct browser → ARM calls.
 * Tokens are minted by the SWA AAD identity provider and fetched from
 * `/api/azure/token`. They are kept **only** in module-scoped memory:
 *
 *   - NEVER stored in localStorage
 *   - NEVER stored in sessionStorage
 *   - NEVER stored in IndexedDB
 *   - NEVER set as a cookie
 *   - NEVER logged
 *
 * On a 401 from ARM the client refreshes the token from `/api/azure/token`
 * **at most once** and retries the original request **at most once** before
 * surfacing an `auth-error`.
 *
 * All callers receive a typed `Result<T, ArmClientError>` — no `any`-typed
 * fetch is exposed.
 */

const ARM_BASE_URL = 'https://management.azure.com';
const TOKEN_ENDPOINT = '/api/azure/token';

// ---------------------------------------------------------------------------
// Memory-only token cache (Zapp condition).
//
// The token lives in a module-scoped variable — closed over by this module
// and never written to any persistent storage. It is cleared on logout
// signals (401 from /api/azure/token) and on explicit `clearTokenCache()`.
// ---------------------------------------------------------------------------

interface TokenCacheEntry {
  token: string;
  /** Epoch ms; undefined when SWA didn't provide a hint. */
  expiresAtMs?: number;
}

let tokenCache: TokenCacheEntry | null = null;

/** Visible for tests. Forces the next ARM call to re-fetch from the API. */
export function clearTokenCache(): void {
  tokenCache = null;
}

/** Visible for tests — never returns the token, only whether one is cached. */
export function isTokenCached(): boolean {
  return tokenCache !== null;
}

// ---------------------------------------------------------------------------
// Discriminated error union (Nibbler condition).
// ---------------------------------------------------------------------------

export type ArmClientError =
  | { kind: 'auth-error'; status: 401 | 403; message: string }
  | { kind: 'network-error'; message: string }
  | { kind: 'arm-error'; status: number; code?: string; message: string; details?: unknown };

export type ArmResult<T> =
  | { ok: true; status: number; value: T }
  | { ok: false; error: ArmClientError };

// ---------------------------------------------------------------------------
// Token fetching
// ---------------------------------------------------------------------------

interface TokenResponseBody {
  token?: unknown;
  expiresAt?: unknown;
  error?: unknown;
  code?: unknown;
}

async function fetchFreshToken(): Promise<TokenCacheEntry | ArmClientError> {
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    return {
      kind: 'network-error',
      message: err instanceof Error ? err.message : 'Failed to reach the Azure token endpoint.',
    };
  }

  const body = (await response.json().catch(() => undefined)) as TokenResponseBody | undefined;

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      const message =
        (typeof body?.error === 'string' && body.error) ||
        'Sign in with Microsoft to access Azure.';
      return { kind: 'auth-error', status, message };
    }
    return {
      kind: 'arm-error',
      status,
      ...(typeof body?.code === 'string' ? { code: body.code } : {}),
      message:
        (typeof body?.error === 'string' && body.error) ||
        `Azure token endpoint failed (${status}).`,
    };
  }

  if (!body || typeof body.token !== 'string' || !body.token) {
    return {
      kind: 'arm-error',
      status: response.status,
      message: 'Azure token endpoint returned an empty token.',
    };
  }

  const expiresAtMs =
    typeof body.expiresAt === 'string' && Number.isFinite(Date.parse(body.expiresAt))
      ? Date.parse(body.expiresAt)
      : undefined;

  return { token: body.token, ...(expiresAtMs !== undefined ? { expiresAtMs } : {}) };
}

async function getToken(forceRefresh: boolean): Promise<string | ArmClientError> {
  if (!forceRefresh && tokenCache) {
    // If we know the expiry and it is still in the future (with 60s skew), reuse.
    if (tokenCache.expiresAtMs === undefined || tokenCache.expiresAtMs - 60_000 > Date.now()) {
      return tokenCache.token;
    }
  }

  const fresh = await fetchFreshToken();
  if ('kind' in fresh) {
    // Auth failure — drop any stale token so subsequent calls don't reuse it.
    if (fresh.kind === 'auth-error') {
      tokenCache = null;
    }
    return fresh;
  }

  tokenCache = fresh;
  return fresh.token;
}

// ---------------------------------------------------------------------------
// ARM request core (with at-most-one 401-refresh-retry — Nibbler condition).
// ---------------------------------------------------------------------------

export interface ArmRequestOptions {
  method: string;
  /** Path beginning with "/" — appended to https://management.azure.com */
  path: string;
  /** Optional body — serialized as JSON. */
  body?: unknown;
  /** Extra headers (Authorization is set automatically). */
  headers?: Record<string, string>;
}

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${ARM_BASE_URL}${normalizedPath}`;
}

function isArmListResponse<T>(value: unknown): value is { value?: T[] } {
  return typeof value === 'object' && value !== null;
}

async function performArmFetch(
  url: string,
  options: ArmRequestOptions,
  token: string,
): Promise<Response | ArmClientError> {
  const method = options.method.toUpperCase();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...options.headers,
  };

  const init: RequestInit = { method, headers };
  if (options.body !== undefined && !['GET', 'HEAD'].includes(method)) {
    headers['Content-Type'] ??= 'application/json';
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  try {
    return await fetch(url, init);
  } catch (err) {
    return {
      kind: 'network-error',
      // Be careful: do not echo the request init or token in error messages.
      message: err instanceof Error ? err.message : 'ARM request failed.',
    };
  }
}

async function readArmError(response: Response): Promise<ArmClientError> {
  let code: string | undefined;
  let message = `Azure request failed (${response.status}).`;
  let details: unknown;

  try {
    const body = (await response.json()) as { error?: { code?: unknown; message?: unknown } };
    details = body;
    if (body && typeof body.error === 'object' && body.error !== null) {
      const e = body.error as { code?: unknown; message?: unknown };
      if (typeof e.code === 'string' && e.code) code = e.code;
      if (typeof e.message === 'string' && e.message.trim()) message = e.message.trim();
    }
  } catch {
    // Non-JSON body — keep the status-derived message.
  }

  if (response.status === 401 || response.status === 403) {
    return { kind: 'auth-error', status: response.status as 401 | 403, message };
  }

  return {
    kind: 'arm-error',
    status: response.status,
    ...(code ? { code } : {}),
    message,
    ...(details !== undefined ? { details } : {}),
  };
}

/**
 * Issue a typed ARM request. Implements the at-most-one 401 refresh-retry
 * required by Nibbler. The token is refreshed exactly once on 401; a second
 * 401 surfaces an `auth-error`.
 */
export async function armRequest<T = unknown>(
  options: ArmRequestOptions,
): Promise<ArmResult<T>> {
  const url = buildUrl(options.path);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const tokenResult = await getToken(attempt === 1);
    if (typeof tokenResult !== 'string') {
      return { ok: false, error: tokenResult };
    }

    const fetchResult = await performArmFetch(url, options, tokenResult);
    if ('kind' in fetchResult) {
      return { ok: false, error: fetchResult };
    }

    if (fetchResult.status === 401 && attempt === 0) {
      // Drop the cached token and retry exactly once with a fresh one.
      tokenCache = null;
      continue;
    }

    if (!fetchResult.ok) {
      return { ok: false, error: await readArmError(fetchResult) };
    }

    if (fetchResult.status === 204) {
      return { ok: true, status: 204, value: undefined as T };
    }

    const text = await fetchResult.text();
    const value = (text ? (JSON.parse(text) as T) : (undefined as T));
    return { ok: true, status: fetchResult.status, value };
  }

  // Unreachable — the loop returns on every path. Defensive return for TS.
  return {
    ok: false,
    error: { kind: 'auth-error', status: 401, message: 'Azure authentication failed after retry.' },
  };
}

/**
 * Convenience wrapper for ARM list endpoints (`{ value: T[] }`).
 */
export async function armList<T = unknown>(
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
): Promise<ArmResult<T[]>> {
  const result = await armRequest<unknown>({
    method: init.method ?? 'GET',
    path,
    ...(init.headers ? { headers: init.headers } : {}),
  });

  if (!result.ok) return result;

  const items = isArmListResponse<T>(result.value) && Array.isArray(result.value.value)
    ? result.value.value
    : [];
  return { ok: true, status: result.status, value: items };
}

/**
 * Lower-level escape hatch used by `BrowserAzureARMConnector.request()`.
 *
 * Returns the raw `Response` so the legacy `APIConnector.request()` shape
 * keeps working during migration. Internally it still goes through the
 * memory-only token cache and the at-most-one 401 retry.
 *
 * Errors that happen *before* a Response can be produced (network failure,
 * token endpoint unreachable, 2× 401) are surfaced as a synthetic
 * `Response` whose JSON body matches the `{ error, code }` shape that the
 * old proxy emitted, so the existing UI error paths keep working.
 */
export async function armFetchRaw(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const url = buildUrl(path);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const tokenResult = await getToken(attempt === 1);
    if (typeof tokenResult !== 'string') {
      return synthError(tokenResult);
    }

    const fetchResult = await performArmFetch(url, { method, path, body }, tokenResult);
    if ('kind' in fetchResult) {
      return synthError(fetchResult);
    }

    if (fetchResult.status === 401 && attempt === 0) {
      tokenCache = null;
      continue;
    }

    return fetchResult;
  }

  return synthError({
    kind: 'auth-error',
    status: 401,
    message: 'Azure authentication failed after retry.',
  });
}

function synthError(error: ArmClientError): Response {
  const status =
    error.kind === 'network-error' ? 502 : error.kind === 'auth-error' ? error.status : error.status;
  const code =
    error.kind === 'network-error'
      ? 'arm_network_error'
      : error.kind === 'auth-error'
        ? 'azure_access_token_missing'
        : (error.code ?? 'arm_error');
  return new Response(
    JSON.stringify({ error: error.message, code }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}
