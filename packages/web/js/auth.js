/**
 * Authentication module — SWA built-in auth + MSAL for Graph API tokens
 * @module auth
 *
 * Primary auth: SWA built-in (/.auth/login/aad) — sets session cookie for API calls.
 * Secondary: MSAL (Graph API tokens only, e.g. profile photo).
 * MSAL loaded via CDN in index.html (global `msal` object).
 */

const Auth = (() => {
  'use strict';

  const hostname = window.location.hostname;
  const origin = window.location.origin;

  const ENV = (() => {
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
    if (hostname === 'kickstart.aks.azure.sabbour.me') return 'staging';
    if (hostname === 'kickstart.aks.azure.com') return 'production';
    return 'unknown';
  })();

  const REDIRECT_URI = {
    local: origin,
    staging: 'https://kickstart.aks.azure.sabbour.me',
    production: 'https://kickstart.aks.azure.com',
    unknown: origin,
  }[ENV];

  const ENTRA = {
    clientId: 'e71a23c6-aeb4-459a-88fc-07ff96fc9b92',
    tenantId: 'd91aa5af-8c1e-442c-b77c-0b92988b387b',
    authority: 'https://login.microsoftonline.com/d91aa5af-8c1e-442c-b77c-0b92988b387b',
    redirectUri: REDIRECT_URI,
    scopes: {
      login: ['openid', 'profile', 'User.Read'],
      arm: ['https://management.azure.com/user_impersonation'],
    },
  };

  const GITHUB = {
    clientId: 'REPLACE_WITH_GITHUB_CLIENT_ID',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    scopes: 'repo user workflow',
    callbackPath: '/.auth/login/github/callback',
    callbackUrl: `${REDIRECT_URI}/.auth/login/github/callback`,
  };

  // --- SWA auth state ---
  let clientPrincipal = null;

  // --- MSAL instance (for Graph API tokens only) ---
  let msalInstance = null;

  function getMsal() {
    if (msalInstance) return msalInstance;
    if (typeof msal === 'undefined') {
      console.warn('[Auth] MSAL library not loaded — Graph API tokens unavailable');
      return null;
    }

    msalInstance = new msal.PublicClientApplication({
      auth: {
        clientId: ENTRA.clientId,
        authority: ENTRA.authority,
        redirectUri: ENTRA.redirectUri,
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
      },
    });

    return msalInstance;
  }

  // --- Initialize: check SWA session + init MSAL ---
  async function initialize() {
    // 1. Check SWA built-in auth session
    try {
      const res = await fetch('/.auth/me');
      if (res.ok) {
        const data = await res.json();
        clientPrincipal = data.clientPrincipal || null;
      }
    } catch (err) {
      console.warn('[Auth] SWA auth check failed:', err);
    }

    // 2. Initialize MSAL for Graph API token acquisition
    const client = getMsal();
    if (client) {
      try {
        await client.handleRedirectPromise();
      } catch (err) {
        console.warn('[Auth] MSAL init error:', err);
      }
    }
  }

  // --- Login via SWA built-in auth (full-page redirect) ---
  function login() {
    window.location.href = '/.auth/login/aad?post_login_redirect_uri=/';
    return new Promise(() => {}); // page navigates away
  }

  // --- Logout via SWA built-in auth ---
  function logout() {
    window.location.href = '/.auth/logout?post_logout_redirect_uri=/';
    return new Promise(() => {}); // page navigates away
  }

  // --- Token acquisition (MSAL — for Graph API only) ---
  async function getToken(scopes) {
    const client = getMsal();
    if (!client) return null;

    const requestScopes = scopes ?? ENTRA.scopes.login;

    // Try cached MSAL accounts first
    const accounts = client.getAllAccounts();
    if (accounts.length > 0) {
      try {
        const response = await client.acquireTokenSilent({
          scopes: requestScopes,
          account: accounts[0],
        });
        return response.accessToken;
      } catch { /* fall through */ }
    }

    // Try SSO silent — leverages existing Entra session from SWA login
    if (clientPrincipal) {
      try {
        const response = await client.ssoSilent({
          scopes: requestScopes,
          loginHint: clientPrincipal.userDetails,
        });
        return response.accessToken;
      } catch { /* fall through */ }
    }

    // Interactive fallback (popup)
    try {
      const response = await client.acquireTokenPopup({
        scopes: requestScopes,
      });
      return response.accessToken;
    } catch (err) {
      console.warn('[Auth] Token acquisition failed:', err);
      return null;
    }
  }

  async function getArmToken() {
    return getToken(ENTRA.scopes.arm);
  }

  // --- State (from SWA clientPrincipal) ---
  function isAuthenticated() {
    return clientPrincipal !== null;
  }

  function getUserInfo() {
    if (!clientPrincipal) return null;
    const claims = clientPrincipal.claims || [];
    const nameClaim = claims.find(c => c.typ === 'name');
    const emailClaim = claims.find(c =>
      c.typ === 'preferred_username' ||
      c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
    );
    const name = nameClaim?.val || clientPrincipal.userDetails || 'User';
    const email = emailClaim?.val || clientPrincipal.userDetails || '';
    return { name, email, initials: getInitials(name) };
  }

  // --- GitHub OAuth ---
  function loginWithGitHub() {
    const params = new URLSearchParams({
      client_id: GITHUB.clientId,
      redirect_uri: GITHUB.callbackUrl,
      scope: GITHUB.scopes,
    });
    window.location.href = `${GITHUB.authorizeUrl}?${params}`;
  }

  // --- Helpers ---
  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  return Object.freeze({
    initialize,
    login,
    logout,
    getToken,
    getArmToken,
    isAuthenticated,
    getUserInfo,
    loginWithGitHub,
    get env() { return ENV; },
  });
})();

export default Auth;
