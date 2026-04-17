/**
 * github-handoff.browser.ts
 *
 * Client-only OAuth handoff module — handles the GitHub OAuth redirect and callback flow
 * entirely in the browser. NOT imported by any server-side tool or service.
 *
 * Marked browser-only: uses window.location and window.opener.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GitHubOAuthCallbackResult {
  code: string;
  state: string;
}

// ── OAuth redirect helpers ────────────────────────────────────────────────────

/**
 * Redirects the browser to the GitHub OAuth authorization URL.
 * Called from the Login component to initiate the OAuth flow.
 */
export function redirectToGitHubOAuth(options: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}): void {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('scope', options.scopes.join(' '));
  url.searchParams.set('state', options.state);

  window.location.href = url.toString();
}

/**
 * Opens a GitHub OAuth authorization popup window.
 * The popup will redirect back to the callback URL and post a message to the opener.
 */
export function openGitHubOAuthPopup(options: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}): Window | null {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('scope', options.scopes.join(' '));
  url.searchParams.set('state', options.state);

  return window.open(
    url.toString(),
    'github-oauth',
    'width=600,height=700,scrollbars=yes,resizable=yes',
  );
}

/**
 * Parses the OAuth callback parameters from the current URL.
 * Called on the OAuth callback page after GitHub redirects back.
 */
export function parseOAuthCallback(): GitHubOAuthCallbackResult | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return null;
  return { code, state };
}

/**
 * Posts the OAuth callback result to the parent window (when running in popup mode)
 * then closes the popup.
 */
export function postCallbackToOpener(result: GitHubOAuthCallbackResult): void {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(
      { type: 'github-oauth-callback', ...result },
      window.location.origin,
    );
  }
  window.close();
}

/**
 * Listens for the OAuth callback message from a popup window.
 * Resolves with the callback result or rejects on timeout.
 */
export function waitForOAuthCallback(
  expectedState: string,
  timeoutMs = 120_000,
): Promise<GitHubOAuthCallbackResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('GitHub OAuth timed out'));
    }, timeoutMs);

    function handler(event: MessageEvent): void {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; code?: string; state?: string };
      if (data.type !== 'github-oauth-callback') return;
      if (data.state !== expectedState) return;
      clearTimeout(timer);
      window.removeEventListener('message', handler);
      if (!data.code || !data.state) {
        reject(new Error('OAuth callback missing code or state'));
        return;
      }
      resolve({ code: data.code, state: data.state });
    }

    window.addEventListener('message', handler);
  });
}
