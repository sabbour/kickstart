# Decision: GitHub A2UI Fat Component Security Patterns

**Author:** Fry (Frontend Dev)
**Date:** 2026-04-12
**Status:** Implemented
**Related:** #32, DP v2 (Zapp-approved)

## Context

GitHub fat components needed security guardrails matching Zapp's review conditions from the DP v2. These patterns are now established and should be followed for any future integration kit components.

## Decisions

1. **In-memory token storage only** — GitHub tokens are stored in React component state via `useState`, never in `localStorage` or `sessionStorage`. This matches Zapp's explicit security condition. Sign-out clears React state; the connector re-authenticates on next use.

2. **Operation allowlisting for write components** — `GitHubAction` uses a `Set<string>` of allowed operation types. Any `operationType` prop not in the allowlist is blocked at the UI level before the user can click execute. Same pattern used for `AzureAction` with ARM resource types.

3. **Protected-branch blocking** — Both `GitHubAction` and `GitHubCommit` block direct writes to `main`, `master`, and `production` branches. This is a client-side guard matching GitHub's server-side branch protection.

4. **Typed confirmation for destructive operations** — DELETE methods require the user to type the exact resource name extracted from the API path. This follows the same state machine pattern used in `AzureAction`.

5. **Rate-limit handling** — All GitHub API responses check `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers. Rate-limited responses show a warning MessageBar with the reset time.

## Impact

These patterns are now the standard for any future integration kit components (e.g., if we add GitLab, Bitbucket, or other service packs). Security review should verify all new write-capable components follow these guardrails.
