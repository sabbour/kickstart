/**
 * Authentication module — MSAL.js (Entra ID) + GitHub OAuth
 * @module auth
 *
 * MSAL loaded via CDN in index.html (global `msal` object).
 */

const Auth = (() => {
  'use strict';

  // --- Configuration (environment-aware) ---
  const hostname = window.location.hostname;
  const origin = window.location.origin;

  const ENV = (() => {
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
    if (hostname === 'kickstart.prototypes.aks.azure.sabbour.me') return 'staging';
    if (hostname === 'kickstart.aks.azure.com') return 'production';
    return 'unknown';
  })();

  const REDIRECT_URI = {
    local: origin,
    staging: 'https://kickstart.prototypes.aks.azure.sabbour.me',
    production: 'https://kickstart.aks.azure.com',
    unknown: origin,
  }[ENV];

  const ENTRA = {
    clientId: '7a630e18-8f49-404e-8454-228b13089c57',
    tenantId: '72f988bf-86f1-41af-91ab-2d7cd011db47',
    authority: 'https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47',
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

  // --- MSAL instance (lazy) ---
  let msalInstance = null;
  let currentAccount = null;

  function getMsal() {
    if (msalInstance) return msalInstance;
    if (typeof msal === 'undefined') {
      console.warn('[Auth] MSAL library not loaded — Entra ID auth unavailable');
      return null;
    }

    msalInstance = new msal.PublicClientApplication({
      auth: {
        clientId: ENTRA.clientId,
        authority: ENTRA.authority,
        redirectUri: ENTRA.redirectUri,
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
    });

    return msalInstance;
  }

  // --- Initialize (call on page load) ---
  async function initialize() {
    const client = getMsal();
    if (!client) return;

    try {
      const response = await client.handleRedirectPromise();
      if (response) {
        currentAccount = response.account;
      } else {
        const accounts = client.getAllAccounts();
        currentAccount = accounts.length > 0 ? accounts[0] : null;
      }
    } catch (err) {
      console.error('[Auth] MSAL initialization error:', err);
    }
  }

  // --- Login (Entra ID) ---
  async function login() {
    const client = getMsal();
    if (!client) return null;

    try {
      const response = await client.loginPopup({
        scopes: ENTRA.scopes.login,
      });
      currentAccount = response.account;
      return getUserInfo();
    } catch (err) {
      if (err.errorCode === 'user_cancelled') return null;
      console.error('[Auth] Login failed:', err);
      throw err;
    }
  }

  // --- Logout ---
  async function logout() {
    const client = getMsal();
    if (!client) return;

    try {
      await client.logoutPopup({ account: currentAccount });
      currentAccount = null;
    } catch (err) {
      console.error('[Auth] Logout failed:', err);
    }
  }

  // --- Token acquisition ---
  async function getToken(scopes) {
    const client = getMsal();
    if (!client || !currentAccount) return null;

    const request = {
      scopes: scopes ?? ENTRA.scopes.login,
      account: currentAccount,
    };

    try {
      const response = await client.acquireTokenSilent(request);
      return response.accessToken;
    } catch (err) {
      // Fallback to interactive
      try {
        const response = await client.acquireTokenPopup(request);
        return response.accessToken;
      } catch (interactiveErr) {
        console.error('[Auth] Token acquisition failed:', interactiveErr);
        return null;
      }
    }
  }

  async function getArmToken() {
    return getToken(ENTRA.scopes.arm);
  }

  // --- State ---
  function isAuthenticated() {
    return currentAccount !== null;
  }

  function getUserInfo() {
    if (!currentAccount) return null;
    return {
      name: currentAccount.name ?? 'User',
      email: currentAccount.username,
      initials: getInitials(currentAccount.name),
    };
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
