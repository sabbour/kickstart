---
sidebar_position: 2
---

# ADR-0002: Surface Auth Errors in Chat UI on Redirect-Retry Failure

**Date:** 2026-04-27  
**Status:** Accepted  
**Deciders:** Ahmed Sabbour (Lead), Squad  
**Affects:** `packages/web` — `useStreaming.ts`, `App.tsx`, SWA auth flow

## Context

Kickstart is deployed as an Azure Static Web App (SWA). SWA provides built-in Easy Auth via `/.auth/login/aad`. When a user accesses the chat while unauthenticated, `useStreaming.send()` catches a `SessionExpiredError` and redirects the browser to the AAD login page.

### Problem Statement

If the AAD login succeeds but the browser returns the user still unauthenticated (broken SSO auto-redirect, misconfigured Entra ID, or a stale auth cookie), `App.tsx` fires the `auth-redirect-pending` retry effect — re-calling `handleSendMessage` with `isAuthRetry=true`. The same `SessionExpiredError` is thrown again, the same redirect fires, and the cycle repeats. In production this produced **1244+ rapid redirect requests** before the browser stopped.

## Decision

**On the first `SessionExpiredError`, redirect to AAD as before. On the auth-retry attempt (`isAuthRetry=true`), surface the error in the chat UI instead of redirecting.**

Concretely:

- `App.tsx` sets `AUTH_REDIRECT_PENDING_KEY` in `sessionStorage` before redirecting, and clears it after a successful auth return.
- `handleSendMessage` receives an `isAuthRetry` boolean parameter.
- `useStreaming.send()` receives `isAuthRetry` and passes it to `_handleSessionExpiredError`.
- `_handleSessionExpiredError` checks `isAuthRetry`: if `true`, it calls `callbacks.onError(err.message)` and returns without redirecting.

### Why surface the error in the UI?

1. **Breaks the loop deterministically.** A second redirect cannot fix an auth failure that a first redirect could not — the user needs to take a different action (clear cookies, contact IT, use a different browser).
2. **Gives the user actionable information.** The `SESSION_EXPIRED_ERROR_MESSAGE` prompts the user to sign in again via a different path, rather than silently looping.
3. **Preserves the happy path.** The first `SessionExpiredError` still triggers an AAD redirect; only the retry failure is handled differently.

### Why extract `_handleSessionExpiredError`?

The handler uses `window.location` and `sessionStorage` — browser globals that are unavailable in Vitest's jsdom environment at the level of a unit test. Extracting the pure logic with injected `redirect` and `storage` parameters makes the redirect-loop guard fully testable without a React rendering context or browser stubs.

## Alternatives Considered

### 1. Retry limit counter (e.g., max 3 redirects)

**Pros:** Allows for transient failures before giving up.  
**Cons:**
- Still loops 3× before stopping; in a broken SSO environment this is 3× the noise.
- Counter state must survive the page reload triggered by the redirect — requires additional sessionStorage bookkeeping.
- The root cause (broken auth) is not transient; retrying it is not helpful.

**Rejected:** More complex, still loops, no user benefit over a single retry.

### 2. Redirect to a dedicated error page

**Pros:** Clear, unambiguous error state.  
**Cons:**
- Loses chat context; user must navigate back.
- Requires a new route and UI surface to maintain.
- Over-engineered for a rare failure path.

**Rejected:** The chat error message is sufficient and keeps the user in context.

### 3. Do nothing (let the browser's redirect loop protection kick in)

**Pros:** No code change needed.  
**Cons:**
- Browser behaviour is inconsistent and not spec-mandated; Chrome, Firefox, and Edge stop at different thresholds.
- In production, 1244+ rapid requests caused observable backend load before browsers intervened.
- Produces a confusing browser error page rather than a meaningful message.

**Rejected:** Unreliable and poor user experience.

## Consequences

- **Positive:** Infinite auth redirect loop is eliminated. Users see a clear error message in the chat instead.
- **Positive:** `_handleSessionExpiredError` is independently unit-testable; regression is covered by `auth-redirect-loop.test.ts`.
- **Neutral:** `useStreaming.send()` gains an `isAuthRetry` optional parameter (backward-compatible).
- **Negative:** Users who encounter a broken SSO config must take manual action (clear cookies, use a different browser) — but this was always true; the previous behaviour just masked it.

## References

- PR [#80](https://github.com/azure-management-and-platforms/kickstart/pull/80) — fix: break auth redirect loop on unauthenticated chat access
- `packages/web/src/hooks/useStreaming.ts` — `_handleSessionExpiredError`
- `packages/web/src/__tests__/auth-redirect-loop.test.ts` — regression tests
