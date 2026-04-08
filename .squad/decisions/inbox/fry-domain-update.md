# Decision: Shorten staging domain

**Date:** 2025-07-17
**Author:** Fry (Frontend Dev)
**Status:** Accepted

## Context

The temporary staging domain `kickstart.prototypes.aks.azure.sabbour.me` contained an unnecessary `.prototypes` segment that added no value and made URLs longer.

## Decision

Replace all references with `kickstart.aks.azure.sabbour.me` across infra config, docs, and frontend code. The production domain `kickstart.aks.azure.com` is unchanged.

## Files affected

- `infra/main.bicep` — Bicep param description and comment
- `infra/setup-entra.sh` — Entra redirect URI
- `infra/README.md` — infrastructure docs
- `infra/parameters.dev.json` — dev deployment parameter
- `docs/architecture.md` — domain table
- `docs/deployment.md` — staging domain references
- `packages/web/js/auth.js` — hostname detection and redirect URI
- `packages/web/staticwebapp.config.json` — comment

## Impact

- DNS CNAME and Entra app registration must be updated to match the new domain.
- `.squad/` files were intentionally left untouched (append-only policy).
