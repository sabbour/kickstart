# Bender decision inbox — separate user OAuth token flow

**Date:** 2026-04-24T11:00:28.567-07:00
**Context:** GitHub Apps in Squad now need both installation tokens and user-to-server OAuth tokens without storing new secrets in the repo.

## Decision

Store GitHub App OAuth client secrets and user OAuth tokens alongside PEM files in the external `keysDir`, and make `resolve-token.mjs --user` a separate opt-in path from installation-token resolution.

## Why

- OAuth client secrets and refresh tokens are secret material and belong in the same external storage boundary as PEM files.
- Installation tokens and user tokens represent different identities and should never be conflated implicitly.
- A dedicated `oauth-login.mjs` flow keeps browser authorization and token exchange out of the normal app-token resolver path.

## Consequences

- `create-app.mjs` must save an external `{role}.oauth.json` file with the client secret and callback URL.
- Users need to run `oauth-login.mjs` once per role before `resolve-token.mjs --user` can succeed.
- `resolve-token.mjs` now handles refresh-token rotation for user OAuth tokens while preserving the existing installation-token default.
