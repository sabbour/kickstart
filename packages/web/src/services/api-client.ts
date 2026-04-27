// Typed API client for the Kickstart backend
// Supports both streaming (SSE) and standard request modes

export const SESSION_EXPIRED_ERROR_MESSAGE = 'Your session has expired. Please sign in again. You may be redirected to the login page.';
export const AUTH_REDIRECT_PENDING_KEY = 'kickstart:auth-redirect-pending';

export class SessionExpiredError extends Error {
  constructor() {
    super(SESSION_EXPIRED_ERROR_MESSAGE);
    this.name = 'SessionExpiredError';
  }
}

const SWA_LOGIN_PATH = '/.auth/login/aad';
const SWA_REFRESH_PATH = '/.auth/refresh';

export function getCurrentAuthRedirectTarget(): string {
  if (typeof window === 'undefined') {
    return '/';
  }
  const target = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return target || '/';
}

export function buildSwaLoginUrl(redirectTarget = getCurrentAuthRedirectTarget()): string {
  return `${SWA_LOGIN_PATH}?post_login_redirect_uri=${encodeURIComponent(redirectTarget)}`;
}

async function refreshSwaAuthSession(): Promise<boolean> {
  try {
    const res = await fetch(SWA_REFRESH_PATH, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Anonymous session token propagation (#23)
//
// The API mints a per-session bearer token for anonymous users. The client
// must persist and forward it on every subsequent request for that session.
// Uses sessionStorage (tab-scoped, cleared on tab close) per Zapp's approval.
// ---------------------------------------------------------------------------

const ANON_TOKEN_PREFIX = 'kickstart:anon-token:';

/** Store an anonymous session token received from a `session_token` SSE event. */
export function storeAnonSessionToken(sessionId: string, token: string): void {
  try {
    sessionStorage.setItem(`${ANON_TOKEN_PREFIX}${sessionId}`, token);
  } catch { /* quota exceeded or unavailable — degrade gracefully */ }
}

/** Retrieve a previously stored anonymous session token for a session. */
export function getAnonSessionToken(sessionId: string): string | null {
  try {
    return sessionStorage.getItem(`${ANON_TOKEN_PREFIX}${sessionId}`);
  } catch { return null; }
}

/** Clear the anonymous session token (e.g. on sign-out or new session). */
export function clearAnonSessionToken(sessionId: string): void {
  try {
    sessionStorage.removeItem(`${ANON_TOKEN_PREFIX}${sessionId}`);
  } catch { /* noop */ }
}

/**
 * Wrapper around fetch() for authenticated API endpoints.
 *
 * Uses `redirect: 'manual'` to prevent the browser from silently following
 * SWA's 401→302 auth redirect to Azure AD. Without this, the cross-origin
 * redirect fails with a CORS error that surfaces as "Failed to fetch".
 *
 * When `debugMode` is true, adds the `x-kickstart-debug: true` header so
 * the backend returns debug metadata in the SSE stream.
 */
export async function apiFetch(url: string, init?: RequestInit, debugMode?: boolean, sessionId?: string): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (debugMode) {
    headers.set('x-kickstart-debug', 'true');
  }
  // Attach anonymous session token if we have one for this session (#23)
  if (sessionId) {
    const anonToken = getAnonSessionToken(sessionId);
    if (anonToken) {
      headers.set('x-anon-session-token', anonToken);
    }
  }
  const requestInit = { ...init, headers, redirect: 'manual' as const };
  const res = await fetch(url, requestInit);

  if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
    if (await refreshSwaAuthSession()) {
      const retryRes = await fetch(url, requestInit);
      if (!(retryRes.type === 'opaqueredirect' || (retryRes.status >= 300 && retryRes.status < 400))) {
        return retryRes;
      }
    }
    throw new SessionExpiredError();
  }

  return res;
}

export interface ConversationRequest {
  sessionId?: string;
  message: string;
  stream?: boolean;
}

export interface ConversationResponse {
  sessionId: string;
  phase: string;
  message: string;
  a2ui?: unknown[];
  model?: string;
  usage?: import('../types').TokenUsageSummary;
}

export interface HealthCheckError {
  phase: string;
  message: string;
  hint?: string;
}

export interface HealthCheckResult {
  ok: boolean;
  error?: HealthCheckError;
}

export async function healthCheck(): Promise<HealthCheckResult> {
  try {
    const res = await fetch('/api/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      return { ok: true };
    }

    // Server returned an error (e.g., 503) — extract diagnostics
    try {
      const body = await res.json() as {
        status?: string;
        phase?: string;
        message?: string;
        detail?: string;
        hint?: string;
      };

      const error: HealthCheckError = {
        phase: body.phase || 'api-error',
        message: body.detail || body.message || 'API returned an error',
        hint: body.hint,
      };

      console.error('[healthCheck] API error:', error);
      return { ok: false, error };
    } catch {
      // Could not parse error response
      return {
        ok: false,
        error: {
          phase: 'api-error',
          message: `API returned ${res.status} ${res.statusText}`,
        },
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[healthCheck] Network or timeout error:', message);

    // Distinguish between timeout and network errors
    const isTimeout = err instanceof Error && 'name' in err && err.name === 'AbortError';

    return {
      ok: false,
      error: {
        phase: isTimeout ? 'api-timeout' : 'api-unreachable',
        message: isTimeout
          ? 'API health check timed out (5s)'
          : 'API is not reachable. Check that Azure Functions are running.',
        hint: isTimeout
          ? 'The API may be slow or overloaded. Try again in a few moments.'
          : 'Ensure the API server is running and accessible.',
      },
    };
  }
}

export async function converse(req: ConversationRequest): Promise<ConversationResponse> {
  const res = await apiFetch('/api/converse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
