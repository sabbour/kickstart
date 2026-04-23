# Fry — PR #568 Fix Report

**Date:** 2025-04-17  
**Branch:** `squad/484-pack-github`

## Commits

| SHA | Fix |
|-----|-----|
| `0d300e3` | Leela B1+B2 — wire validateGithubPath, fix API path allowlist |
| `9763147` | Zapp Critical+Medium — fake encryption stub, fail-closed guardrail, OAuth state |

## All Fixes Applied

### B1 (Leela) — Wire `validateGithubPath()` into `execute()`
`validateGithubPath(input.path)` called as first line of `execute()`. SSRF via `@evil.com/path` blocked.

### B2 (Leela) — Fix allowlist patterns for REST API paths
Replaced 7 file-system path patterns with 7 REST API path patterns (`GITHUB_API_PATH_ALLOWLIST`): `/repos`, `/orgs`, `/user`, `/users`, `/search`, `/gists`, `/rate_limit`.

### Zapp Critical — `setRepositorySecret()` fake encryption removed
`btoa()` stub replaced with a hard `throw`. GitHub Secrets API requires libsodium `crypto_box_seal` — the function now fails explicitly with a message guiding the implementor.

### Zapp Medium — `no-secret-exposure` guardrail fail-closed
`catch` block changed from `{ kind: 'pass' }` to `{ kind: 'block', reason: '...' }` when `JSON.stringify` throws.

### Zapp Medium — `parseOAuthCallback` state validation in redirect mode
`redirectToGitHubOAuth` now writes state to `sessionStorage`. `parseOAuthCallback` reads and removes it, throwing `'OAuth state mismatch'` on mismatch — mirrors CSRF protection already in popup mode's `waitForOAuthCallback`.

## Tests

**pack-github: 53 tests, all passing.**
