# Decision: Retro workflow uses repo-tracked scribe app id

**Date:** 2026-04-20T01:56:21.267-07:00  
**Author:** Bender (Backend Dev)  
**Status:** Proposed

## Context

`Squad · PR Retro` moved onto `actions/create-github-app-token@v1`, but the repo secrets available in production only include the scribe app private key material, not a matching `SQUAD_SCRIBE_APP_ID` secret. The workflow therefore failed at startup with `Input required and not supplied: app-id`, blocking retro PR updates and leaving PR #862 stuck.

## Decision

Use the scribe app's numeric id directly from the repo's recorded identity data in `.squad/identity/config.json` and keep the secret dependency only for the private key (`SQUAD_SCRIBE_APP_PRIVATE_KEY`).

## Why

- The scribe app identity is already tracked in-repo as stable configuration (`3414032` for `sabbour-squad-scribe`).
- GitHub Actions needs a concrete `app-id`; missing-secret indirection adds a failure mode without adding protection.
- The private key remains secret, so the security boundary does not widen.

## Consequences

- `squad-pr-retro.yml` no longer depends on a missing `SQUAD_SCRIBE_APP_ID` secret.
- Retro-log commits and PR updates attribute to `sabbour-squad-scribe[bot]` through the same app token path.
- Future ceremony workflow changes should verify the actual secret shape in repo settings before assuming both app id and private key are secret-backed.
