/**
 * Browser-side ARM client (issue #318 — Wave 1 of #237 Option A2).
 *
 * Exports `armFetch(path, init?)` and `acquireArmToken()` for callers that want
 * to talk to ARM directly from the browser using a SWA-issued token. Tokens
 * are minted by the SWA AAD identity provider (`/api/azure/token`) and held
 * **only** in module-scoped memory:
 *
 *   - NEVER stored in localStorage
 *   - NEVER stored in sessionStorage
 *   - NEVER stored in IndexedDB
 *   - NEVER set as a cookie
 *   - NEVER written to URL params or DOM attributes
 *   - NEVER logged
 *
 * On a 401 from ARM the client refreshes the token from `/api/azure/token`
 * **at most once** and retries the original request **at most once** before
 * surfacing an `auth-error`.
 *
 * Errors are thrown as `ArmFetchError`, a discriminated-union-shaped error
 * (`{ kind: 'auth-error' | 'network-error' | 'arm-error', ... }`) so callers
 * can switch on `err.kind` without parsing strings (Nibbler condition).
 *
 * Concurrent token refreshes are deduplicated via a module-scoped
 * `fetchingTokenRef` promise — mirroring the semantics of
 * `GitHubAuthContext.refresh()`. The ref is cleared in `finally`, not after
 * success, so a failed refresh still releases the lock for the next caller.
 *
 * Note: this module is **additive**. Existing `BrowserAzureARMConnector`
 * callers continue to use `services/arm-client.ts` until #320 migrates them.
 */

const ARM_BASE_URL = 'https://management.azure.com';
const TOKEN_ENDPOINT = '/api/azure/token';

/**
 * Default ARM api-version injected when a caller omits it. Matches the most
 * conservative version used by `BrowserAzureARMConnector` today
 * (`2021-04-01` — see `packages/web/src/contexts/APIConnectorContext.tsx`).
 */
export const DEFAULT_ARM_API_VERSION = '2021-04-01';

/** Hard ceiling on `Retry-After` (seconds). */
const MAX_RETRY_AFTER_SECONDS = 30;

// ---------------------------------------------------------------------------
// Discriminated error union (Nibbler condition).
// ---------------------------------------------------------------------------

export type ArmErrorKind = 'auth-error' | 'network-error' | 'arm-error';

interface ArmAuthError {
  kind: 'auth-error';
  status: 401 | 403;
  message: string;
}

interface ArmNetworkError {
  kind: 'network-error';
  message: string;
  cause?: unknown;
}

interface ArmRemoteError {
  kind: 'arm-error';
  status: number;
  code?: string;
  message: string;
  details?: unknown;
}

export type ArmErrorPayload = ArmAuthError | ArmNetworkError | ArmRemoteError;

/**
 * Thrown by `armFetch` and `acquireArmToken` on any failure. The shape mirrors
 * the discriminated-union contract callers can rely on:
 *
 * ```ts
 * try { await armFetch(path); }
 * catch (err) {
 *   if (err instanceof ArmFetchError) {
 *     switch (err.kind) {
 *       case 'auth-error':    // re-prompt sign-in
 *       case 'network-error': // surface "couldn't reach Azure"
 *       case 'arm-error':     // show err.code / err.message from ARM
 *     }
 *   }
 * }
 * ```
 */
export class ArmFetchError extends Error {
  readonly kind: ArmErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(payload: ArmErrorPayload) {
    super(payload.message);
    this.name = 'ArmFetchError';
    this.kind = payload.kind;
    if (payload.kind !== 'network-error') this.status = payload.status;
    if (payload.kind === 'arm-error' && payload.code) this.code = payload.code;
    if (payload.kind === 'arm-error' && payload.details !== undefined) {
      this.details = payload.details;
    }
    if (payload.kind === 'network-error' && payload.cause !== undefined) {
      // Preserve original cause for debugging; not surfaced through `.message`.
      (this as { cause?: unknown }).cause = payload.cause;
    }
  }
}

// ---------------------------------------------------------------------------
// Memory-only token cache (Zapp condition).
//
// `armToken` is closed over by this module and never read or written from
// the outside. There is no getter, no inspector, no debug accessor.
// `fetchingTokenRef` deduplicates concurrent `/api/azure/token` calls.
// ---------------------------------------------------------------------------

interface ArmTokenEntry {
  value: string;
  /** Epoch ms; undefined if SWA didn't supply an expiry hint. */
  expiresAtMs?: number;
}

let armToken: ArmTokenEntry | null = null;
let fetchingTokenRef: Promise<ArmTokenEntry> | null = null;

/** Test-only — forces the next call to refetch from `/api/azure/token`. */
export function __resetArmTokenForTests(): void {
  armToken = null;
  fetchingTokenRef = null;
}

interface TokenResponseBody {
  token?: unknown;
  expiresAt?: unknown;
  error?: unknown;
  code?: unknown;
}

async function fetchTokenFromEndpoint(): Promise<ArmTokenEntry> {
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    throw new ArmFetchError({
      kind: 'network-error',
      message: err instanceof Error ? err.message : 'Failed to reach the Azure token endpoint.',
      cause: err,
    });
  }

  const body = (await response.json().catch(() => undefined)) as TokenResponseBody | undefined;

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new ArmFetchError({
        kind: 'auth-error',
        status,
        message:
          (typeof body?.error === 'string' && body.error) ||
          'Sign in with Microsoft to access Azure.',
      });
    }
    throw new ArmFetchError({
      kind: 'arm-error',
      status,
      ...(typeof body?.code === 'string' ? { code: body.code } : {}),
      message:
        (typeof body?.error === 'string' && body.error) ||
        `Azure token endpoint failed (${status}).`,
    });
  }

  if (!body || typeof body.token !== 'string' || !body.token) {
    throw new ArmFetchError({
      kind: 'arm-error',
      status: response.status,
      message: 'Azure token endpoint returned an empty token.',
    });
  }

  const expiresAtMs =
    typeof body.expiresAt === 'string' && Number.isFinite(Date.parse(body.expiresAt))
      ? Date.parse(body.expiresAt)
      : undefined;

  return expiresAtMs !== undefined
    ? { value: body.token, expiresAtMs }
    : { value: body.token };
}

/**
 * Acquire an ARM access token, reusing a cached one when it's still valid.
 *
 * Concurrent callers share the same in-flight `/api/azure/token` request via
 * `fetchingTokenRef`. The ref is always cleared in `finally` so a failed
 * refresh doesn't permanently wedge the cache.
 *
 * Throws `ArmFetchError` on failure.
 */
export async function acquireArmToken(
  options: { forceRefresh?: boolean } = {},
): Promise<string> {
  const { forceRefresh = false } = options;

  if (!forceRefresh && armToken) {
    // Reuse cached token if it's not expired (60s clock-skew safety margin).
    if (armToken.expiresAtMs === undefined || armToken.expiresAtMs - 60_000 > Date.now()) {
      return armToken.value;
    }
  }

  if (forceRefresh) armToken = null;

  // Deduplicate concurrent refreshes — first caller spawns the fetch, the
  // rest await the same promise. `fetchingTokenRef` is cleared in `finally`
  // so a rejected refresh releases the lock for the next attempt.
  if (!fetchingTokenRef) {
    fetchingTokenRef = (async () => {
      try {
        const entry = await fetchTokenFromEndpoint();
        armToken = entry;
        return entry;
      } finally {
        fetchingTokenRef = null;
      }
    })();
  }

  const entry = await fetchingTokenRef;
  return entry.value;
}

// ---------------------------------------------------------------------------
// armFetch — direct browser → ARM call with at-most-one 401-refresh-retry.
// ---------------------------------------------------------------------------

export interface ArmFetchInit extends Omit<RequestInit, 'headers'> {
  /** Headers (`Authorization` is set automatically and cannot be overridden). */
  headers?: HeadersInit;
  /**
   * Override the default api-version that's injected when `path` doesn't
   * already specify one. Defaults to {@link DEFAULT_ARM_API_VERSION}.
   * Pass `null` to suppress injection entirely.
   */
  apiVersion?: string | null;
}

function buildArmUrl(path: string, apiVersion: string | null | undefined): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = `${ARM_BASE_URL}${normalized}`;

  if (apiVersion === null) return url;

  // Only inject when caller didn't already specify api-version.
  const sep = normalized.includes('?') ? '&' : '?';
  if (/[?&]api-version=/i.test(normalized)) return url;
  const version = apiVersion ?? DEFAULT_ARM_API_VERSION;
  return `${url}${sep}api-version=${encodeURIComponent(version)}`;
}

function mergeHeaders(token: string, headers: HeadersInit | undefined): Headers {
  const out = new Headers(headers ?? undefined);
  // Authorization is owned by armFetch — overwrite any caller-supplied value.
  out.set('Authorization', `Bearer ${token}`);
  if (!out.has('Accept')) out.set('Accept', 'application/json');
  return out;
}

async function readArmErrorPayload(response: Response): Promise<ArmErrorPayload> {
  let code: string | undefined;
  let message = `Azure request failed (${response.status}).`;
  let details: unknown;

  try {
    const body = (await response.clone().json()) as
      | { error?: { code?: unknown; message?: unknown } }
      | undefined;
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

function parseRetryAfterSeconds(header: string | null): number {
  if (!header) return 0;
  const trimmed = header.trim();
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return Math.min(asNumber, MAX_RETRY_AFTER_SECONDS);
  }
  // HTTP-date form. Be defensive: ARM virtually always uses delta-seconds.
  const dateMs = Date.parse(trimmed);
  if (!Number.isFinite(dateMs)) return 0;
  const deltaSec = Math.ceil((dateMs - Date.now()) / 1000);
  if (deltaSec <= 0) return 0;
  return Math.min(deltaSec, MAX_RETRY_AFTER_SECONDS);
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function performArmFetch(
  url: string,
  init: ArmFetchInit,
  token: string,
): Promise<Response> {
  const { apiVersion: _apiVersion, headers, ...rest } = init;
  const requestInit: RequestInit = {
    ...rest,
    headers: mergeHeaders(token, headers),
  };
  try {
    return await fetch(url, requestInit);
  } catch (err) {
    throw new ArmFetchError({
      kind: 'network-error',
      message: err instanceof Error ? err.message : 'ARM request failed.',
      cause: err,
    });
  }
}

/**
 * Issue a direct browser → ARM request.
 *
 *   - URL is `https://management.azure.com${path}` (absolute, never proxied).
 *   - `Authorization: Bearer <token>` is added from the memory-only cache.
 *   - Default api-version is injected when omitted (parity with the legacy
 *     `BrowserAzureARMConnector`).
 *   - On `401`, the token is refreshed once via `/api/azure/token` and the
 *     request is retried exactly once. A second `401` becomes an `auth-error`.
 *   - On `429` / `503` with `Retry-After`, sleeps up to {@link MAX_RETRY_AFTER_SECONDS}
 *     seconds, then surfaces the response. (Higher-level retry is the caller's
 *     job — we only honour the wait so it isn't ignored entirely.)
 *
 * Throws {@link ArmFetchError} on any failure (network, auth, or ARM error).
 * Returns the raw `Response` on success — callers `.json()` / `.text()` it
 * themselves.
 */
export async function armFetch(path: string, init: ArmFetchInit = {}): Promise<Response> {
  const url = buildArmUrl(path, init.apiVersion);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await acquireArmToken({ forceRefresh: attempt === 1 });
    const response = await performArmFetch(url, init, token);

    if (response.status === 401 && attempt === 0) {
      // Drop the cached token and retry exactly once with a fresh one.
      armToken = null;
      continue;
    }

    if (response.status === 429 || response.status === 503) {
      const waitSec = parseRetryAfterSeconds(response.headers.get('Retry-After'));
      if (waitSec > 0) await sleep(waitSec * 1000);
    }

    if (!response.ok) {
      throw new ArmFetchError(await readArmErrorPayload(response));
    }

    return response;
  }

  // Unreachable — both loop branches return or throw. Defensive guard for TS.
  throw new ArmFetchError({
    kind: 'auth-error',
    status: 401,
    message: 'Azure authentication failed after retry.',
  });
}
