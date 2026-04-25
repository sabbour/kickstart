# Decision: sync-secrets.mjs and secret-based app-id in workflows

**Date:** 2026-04-24
**Author:** Bender (Backend Dev)
**Status:** Accepted

## Context

Workflow `squad-release-cadence.yml` had a hardcoded `app-id: 3340358` which was stale (the lead app is actually `3492550`). PEM keys and app IDs were not being uploaded to GitHub secrets in any automated way.

## Decision

1. **Created `.squad/scripts/sync-secrets.mjs`** — reads identity config, uploads `SQUAD_{ROLE}_APP_PRIVATE_KEY` and `SQUAD_{ROLE}_APP_ID` secrets for every role that has a local PEM file. PEM content is piped via stdin to `gh secret set` (never logged or echoed).

2. **Changed `squad-release-cadence.yml`** line 27 from `app-id: 3340358` to `app-id: ${{ secrets.SQUAD_LEAD_APP_ID }}` so the workflow always uses the value set by sync-secrets.

## Convention

All workflows should reference `${{ secrets.SQUAD_{ROLE}_APP_ID }}` instead of hardcoding numeric app IDs. Run `node .squad/scripts/sync-secrets.mjs` after provisioning new apps or rotating keys.
