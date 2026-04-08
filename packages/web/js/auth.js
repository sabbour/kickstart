/**
 * Authentication module — SWA built-in auth (Entra ID)
 * @module auth
 *
 * Uses SWA built-in auth (/.auth/login/aad) for login/logout and session cookies.
 */

const Auth = (() => {
  'use strict';

  const hostname = window.location.hostname;

  const ENV = (() => {
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
    if (hostname === 'kickstart.aks.azure.sabbour.me') return 'staging';
    if (hostname === 'kickstart.aks.azure.com') return 'production';
    return 'unknown';
  })();

  // --- SWA auth state ---
  let clientPrincipal = null;

  async function initialize() {
    try {
      const res = await fetch('/.auth/me');
      if (res.ok) {
        const data = await res.json();
        clientPrincipal = data.clientPrincipal || null;
      }
    } catch (err) {
      console.warn('[Auth] SWA auth check failed:', err);
    }
  }

  function login() {
    window.location.href = '/.auth/login/aad?post_login_redirect_uri=/';
    return new Promise(() => {});
  }

  function logout() {
    window.location.href = '/.auth/logout?post_logout_redirect_uri=/';
    return new Promise(() => {});
  }

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
    isAuthenticated,
    getUserInfo,
    get env() { return ENV; },
  });
})();

export default Auth;
