---
name: "server-owned-secondary-oauth"
description: "Bind a secondary OAuth provider to the trusted SWA session without widening app access"
domain: "security"
confidence: "high"
source: "issue-274"
---

## Context

Use this pattern when the app already trusts Azure Static Web Apps authentication for primary access, but still needs a second provider such as GitHub for repo-level actions.

## Pattern

1. Keep the app/API access boundary on the existing SWA identity provider.
2. Start the secondary OAuth flow from the server, not the browser.
3. Bind flow state and the resulting provider token to `x-ms-client-principal-id`.
4. Store flow/session cookies as `HttpOnly`, `SameSite=Lax`, encrypted, and short-lived.
5. Expose only narrow server endpoints that perform the needed provider actions.
6. Reject browser token pass-through, fake device flows, and anonymous owner/repo selection.

## Guardrails

- Do **not** add the secondary provider as a first-class SWA identity provider if that would widen who can enter the app.
- Do **not** trust client-supplied access tokens on ship-path actions.
- OAuth callback HTML must respect SWA CSP. If `script-src 'self'` is active, use a same-origin external script instead of inline callback JavaScript.

## Anti-Patterns

- Browser sends `Authorization: Bearer <github-token>` to your API and the API forwards it upstream.
- Anonymous callback or repo endpoints perform actions without re-checking the trusted SWA principal.
- Stub auth/repo data remains in the real handoff path.
