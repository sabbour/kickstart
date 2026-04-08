# Decision: SWA Built-in Auth for Login, MSAL for Graph Tokens Only

**Author:** Bender (Backend Dev)
**Date:** 2025-07-28
**Status:** Accepted

## Context

The app had two auth systems (MSAL popup + SWA built-in route auth) that weren't coordinated. MSAL popup login didn't set the SWA session cookie, so `/api/*` calls protected by `allowedRoles: ["authenticated"]` returned 401→302 redirects, causing "Empty stream response" errors.

## Decision

- **Login/logout:** Use SWA's built-in `/.auth/login/aad` and `/.auth/logout` endpoints (full-page redirects). This sets the session cookie that API route auth requires.
- **Graph API tokens:** Keep MSAL for `acquireTokenSilent`/`ssoSilent`/`acquireTokenPopup` — used only for Graph API calls (profile photos, ARM tokens). MSAL cache moved to `localStorage` to survive redirect.
- **Auth state source of truth:** `/.auth/me` → `clientPrincipal`, not MSAL's `currentAccount`.

## Why

- SWA route auth requires its own session cookie — MSAL tokens in sessionStorage don't satisfy it.
- MSAL is still needed for delegated access tokens (Graph, ARM) that SWA doesn't provide.
- Separating concerns: SWA owns the session, MSAL owns the tokens.

## Impact

- `packages/web/js/auth.js` — full rewrite
- `packages/web/js/app.js` — `/login` path handler simplified
- No changes to API, SWA config, or any backend code
- Exported API surface unchanged — all callers work without modification
