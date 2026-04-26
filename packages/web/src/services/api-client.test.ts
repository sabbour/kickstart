import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiFetch, buildSwaLoginUrl, healthCheck, SessionExpiredError, SESSION_EXPIRED_ERROR_MESSAGE } from './api-client';

describe('healthCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok: true on successful health check (200)', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', registry: 'ready' }), { status: 200 })
    );

    const result = await healthCheck();

    expect(result).toEqual({ ok: true });
  });

  it('extracts error details from 503 response with structured error', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'error',
          phase: 'env-validation',
          message: 'Pack registry initialization failed',
          detail: 'AZURE_OPENAI_API_KEY is not set',
          hint: 'Ensure AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT environment variables are set',
        }),
        { status: 503 }
      )
    );

    const result = await healthCheck();

    expect(result.ok).toBe(false);
    expect(result.error).toEqual({
      phase: 'env-validation',
      message: 'AZURE_OPENAI_API_KEY is not set',
      hint: 'Ensure AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT environment variables are set',
    });
  });

  it('returns network error on fetch timeout', async () => {
    const timeoutError = new Error('The operation was aborted.');
    Object.defineProperty(timeoutError, 'name', { value: 'AbortError' });

    global.fetch = vi.fn().mockRejectedValue(timeoutError);

    const result = await healthCheck();

    expect(result.ok).toBe(false);
    expect(result.error?.phase).toBe('api-timeout');
  });

  it('returns unreachable error on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const result = await healthCheck();

    expect(result.ok).toBe(false);
    expect(result.error?.phase).toBe('api-unreachable');
  });

  it('handles error response without structured body', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('Internal Server Error', { status: 500 })
    );

    const result = await healthCheck();

    expect(result.ok).toBe(false);
    expect(result.error?.phase).toBe('api-error');
    expect(result.error?.message).toContain('500');
  });
});

describe('auth redirect and refresh handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds SWA login URL for the current route including hash session state', () => {
    vi.stubGlobal('window', {
      location: {
        pathname: '/session/local-123',
        search: '?debug=1',
        hash: '#files',
      },
    });

    expect(buildSwaLoginUrl()).toBe(
      '/.auth/login/aad?post_login_redirect_uri=%2Fsession%2Flocal-123%3Fdebug%3D1%23files',
    );
  });

  it('refreshes an expired SWA auth session and retries the original request once', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { Location: '/.auth/login/aad?post_login_redirect_uri=.referrer' },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await apiFetch('/api/converse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    });

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/.auth/refresh');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/converse');
  });

  it('throws SessionExpiredError when refresh does not restore the session', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { Location: '/.auth/login/aad?post_login_redirect_uri=.referrer' },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/converse')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws SessionExpiredError when the refresh request fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { Location: '/.auth/login/aad?post_login_redirect_uri=.referrer' },
      }))
      .mockRejectedValueOnce(new Error('refresh failed'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/converse')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses the canonical session-expired message', () => {
    const error = new SessionExpiredError();
    expect(error.message).toBe(SESSION_EXPIRED_ERROR_MESSAGE);
  });
});
