/**
 * Regression tests for the auth redirect loop bug.
 *
 * When an unauthenticated user sends a message the app redirects to the AAD
 * login page. If the redirect returns the user still unauthenticated (SSO
 * auto-redirect, broken AAD config, etc.), the auth-retry useEffect re-fires
 * handleSendMessage with isAuthRetry=true. A second SessionExpiredError from
 * that retry must surface in the chat UI — NOT trigger another redirect.
 *
 * _handleSessionExpiredError is extracted from useStreaming so it can be
 * exercised here without a React rendering context or browser globals.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _handleSessionExpiredError } from '../hooks/useStreaming';
import { AUTH_REDIRECT_PENDING_KEY, SessionExpiredError, SESSION_EXPIRED_ERROR_MESSAGE } from '../services/api-client';

describe('_handleSessionExpiredError (redirect loop guard)', () => {
  let redirect: (url: string) => void;
  let storage: Pick<Storage, 'setItem'>;
  let onError: (msg: string) => void;

  beforeEach(() => {
    redirect = vi.fn() as (url: string) => void;
    storage = { setItem: vi.fn() as Storage['setItem'] };
    onError = vi.fn() as (msg: string) => void;
  });

  it('sets AUTH_REDIRECT_PENDING_KEY and navigates on first attempt (isAuthRetry=false)', () => {
    _handleSessionExpiredError(new SessionExpiredError(), false, onError, redirect, storage);

    expect(storage.setItem).toHaveBeenCalledWith(AUTH_REDIRECT_PENDING_KEY, '1');
    expect(redirect).toHaveBeenCalledOnce();
    expect(vi.mocked(redirect).mock.calls[0][0]).toContain('/.auth/login/aad');
    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onError and does NOT redirect on auth retry (isAuthRetry=true)', () => {
    _handleSessionExpiredError(new SessionExpiredError(), true, onError, redirect, storage);

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(SESSION_EXPIRED_ERROR_MESSAGE);
    expect(redirect).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('redirects even when storage.setItem throws (private browsing / quota exceeded)', () => {
    const throwingStorage: Pick<Storage, 'setItem'> = {
      setItem: vi.fn().mockImplementation(() => { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); }) as Storage['setItem'],
    };

    // Must not throw — the catch block in _handleSessionExpiredError swallows storage errors
    expect(() =>
      _handleSessionExpiredError(new SessionExpiredError(), false, onError, redirect, throwingStorage)
    ).not.toThrow();

    // Redirect still happens despite storage failure
    expect(redirect).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it('surfaces a descriptive error message so the user can act on it', () => {
    _handleSessionExpiredError(new SessionExpiredError(), true, onError, redirect, storage);

    const msg = vi.mocked(onError).mock.calls[0][0];
    expect(msg).toContain('session has expired');
    expect(msg).toContain('sign in');
  });

  it('login redirect URL includes post_login_redirect_uri parameter', () => {
    _handleSessionExpiredError(new SessionExpiredError(), false, onError, redirect, storage);

    const url = vi.mocked(redirect).mock.calls[0][0];
    expect(url).toContain('post_login_redirect_uri');
  });
});
