# Bender decision inbox — external key directory via config

**Date:** 2026-04-24T10:49:35.684-07:00
**Context:** `create-app.mjs` now stores PEM files outside the repo, so token resolution needs a single configured source for role private keys.

## Decision

Use `.squad/identity/config.json.keysDir` as the repo-local pointer to the external PEM directory. `resolve-token.mjs` expands `~` and reads `{keysDir}/{role}.pem`; if `keysDir` is absent, it falls back to the legacy `.squad/identity/keys/{role}.pem` path.

## Why

- The repo needs one stable place to record where external key material lives.
- Keeping the fallback preserves compatibility for older setups while new flows write only to external storage.
- `create-app.mjs` can wire the new flow automatically by setting `keysDir` when the config is missing it.

## Consequences

- Operators can move keys out of the repo without manually editing `resolve-token.mjs`.
- Existing setups keep working until they migrate `config.json.keysDir`.
- App registration JSON remains repo-local and non-secret, while PEM material stays external.
