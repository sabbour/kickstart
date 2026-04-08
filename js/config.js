/**
 * Imagine — Auth Configuration
 *
 * Client IDs are NOT secrets. They are safe to commit.
 * Client secrets must NEVER appear here — use environment variables or GitHub Secrets.
 */
const ImagineConfig = (() => {
  "use strict";

  // --- Environment detection ---
  const hostname = window.location.hostname;
  const origin = window.location.origin;

  const ENV = (() => {
    if (hostname === "localhost" || hostname === "127.0.0.1") return "local";
    if (hostname === "imagine.prototypes.aks.azure.sabbour.me") return "staging";
    if (hostname === "imagine.aks.azure.com") return "production";
    return "unknown";
  })();

  // --- Redirect URI per environment ---
  const REDIRECT_URIS = {
    local: origin, // http://localhost:8080 or http://localhost:4280
    staging: "https://imagine.prototypes.aks.azure.sabbour.me",
    production: "https://imagine.aks.azure.com",
    unknown: origin,
  };

  const redirectUri = REDIRECT_URIS[ENV];

  // --- Entra ID (MSAL) Configuration ---
  const entra = {
    clientId: "7a630e18-8f49-404e-8454-228b13089c57",
    tenantId: "72f988bf-86f1-41af-91ab-2d7cd011db47",
    authority: "https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47",
    redirectUri: redirectUri,
    scopes: {
      // Minimum for sign-in
      login: ["openid", "profile", "User.Read"],
      // For managing Azure resources on behalf of the user
      arm: ["https://management.azure.com/user_impersonation"],
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    },
  };

  // MSAL configuration object — ready to pass to msal.PublicClientApplication
  const msalConfig = {
    auth: {
      clientId: entra.clientId,
      authority: entra.authority,
      redirectUri: entra.redirectUri,
    },
    cache: entra.cache,
  };

  // --- GitHub OAuth Configuration ---
  const github = {
    // Replace with your GitHub OAuth App Client ID after creating it.
    // See docs/github-oauth-setup.md for instructions.
    clientId: "REPLACE_WITH_GITHUB_CLIENT_ID",
    // GitHub OAuth authorize endpoint
    authorizeUrl: "https://github.com/login/oauth/authorize",
    // Scopes needed: repo access, user info, workflow dispatch
    scopes: "repo user workflow",
    // Callback handled by SWA auth proxy or custom API
    callbackPath: "/.auth/login/github/callback",
    callbackUrl: `${redirectUri}/.auth/login/github/callback`,
  };

  // --- Public API ---
  return Object.freeze({
    env: ENV,
    redirectUri,
    entra,
    msalConfig,
    github,
  });
})();
