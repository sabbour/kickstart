# Decision: Update Entra App Registration IDs in auth.js

**Date:** 2025-07-17
**Author:** Fry (Frontend Dev)
**Status:** Accepted

## Context

`packages/web/js/auth.js` had hardcoded Entra client and tenant IDs from a different (Microsoft corp) app registration:
- clientId: `7a630e18-…` → wrong
- tenantId: `72f988bf-…` → Microsoft corp tenant, wrong

## Decision

Replaced with Ahmed's actual Entra App Registration values:
- clientId: `e71a23c6-aeb4-459a-88fc-07ff96fc9b92`
- tenantId: `d91aa5af-8c1e-442c-b77c-0b92988b387b`

**No changes needed in:**
- `infra/main.bicep` — uses a `param entraClientId` with no hardcoded IDs.
- `infra/setup-entra.sh` — `TENANT` is `caglobaldemos2605.onmicrosoft.com`, which is the friendly domain for Ahmed's tenant (not the old Microsoft corp tenant). Left as-is.
