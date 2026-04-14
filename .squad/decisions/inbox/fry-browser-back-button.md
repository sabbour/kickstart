# Decision: Hash-based Navigation with History API

**Author:** Fry (Frontend Dev)
**Date:** 2026-04-14T17:01:56.521Z
**Context:** Browser back button support for session navigation

## Decision

Use **hash-based routing** (`#session/{id}`) with the History API (`pushState`/`popstate`) for client-side navigation between the landing page and chat sessions.

## Rationale

1. **Hash routing over path routing** — avoids server-side configuration changes. The SWA (Static Web App) doesn't need catch-all redirect rules since the hash never hits the server.
2. **Single `useNavigation` hook** — centralises all history management so every nav path goes through the same API (`pushSession`, `pushLanding`, `replaceCurrent`).
3. **Deep-link support** — users can bookmark or share `#session/{id}` URLs. On load, the app restores the session from localStorage if available, or falls back to landing.

## Implications

- All future navigation paths (e.g., settings page, playground) should follow the same hash pattern through the `useNavigation` hook.
- Session IDs appear in the URL — they're opaque random strings so this is fine for now, but if we ever use meaningful IDs we should consider privacy implications.
