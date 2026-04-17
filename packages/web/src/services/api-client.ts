// Typed API client for the Kickstart backend
// Supports both streaming (SSE) and standard request modes

export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please sign in again. You may be redirected to the login page.');
    this.name = 'SessionExpiredError';
  }
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
export async function apiFetch(url: string, init?: RequestInit, debugMode?: boolean): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (debugMode) {
    headers.set('x-kickstart-debug', 'true');
  }
  const res = await fetch(url, { ...init, headers, redirect: 'manual' });

  if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
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

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
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

/**
 * Call POST /api/session/provision to create an anonymous backend session
 * before the playground user sends their first message.
 *
 * Returns the backend sessionId that should be stored as backendSessionId
 * so converse.ts reuses the provisioned session instead of creating a new one.
 *
 * Throws on network errors or if the server returns 503 (session cap exceeded).
 */
export async function provisionSession(): Promise<{ sessionId: string }> {
  const res = await apiFetch('/api/session/provision', { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Session provision failed: ${res.status}`);
  }
  return res.json() as Promise<{ sessionId: string }>;
}
