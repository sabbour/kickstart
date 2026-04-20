# PR #553 — LRO SSRF Fix Report

**Working as:** Fry (Full-Stack Dev)

## Summary

Fixed the LRO polling SSRF vulnerability identified by Zapp on PR #553 (pack-azure).

## Commit

**SHA:** `bb03761`  
**Message:** `fix(pack-azure): Zapp LRO SSRF — constrain polling URL to ARM host allowlist`

## Where the fix was applied

**File:** `packages/pack-azure/src/services/azure-auth.ts`

Two additions:
1. **`ARM_POLLING_HOSTS`** — `Set<string>` allowlist covering public, US Gov, China, and Germany ARM endpoints.
2. **`assertArmPollingUrl(url)`** — validates HTTPS protocol and hostname membership before any `fetch()` call. Called at the top of `pollArmLro()` so all callers (arm-deploy-resource, arm-delete-resource, arm-update-resource, azure-deployments) are protected automatically.

Both symbols are re-exported from `src/index.ts`.

## Tests

**File:** `packages/pack-azure/src/tools/lro-polling.test.ts` (new)  
**Test count:** 9 tests (all passing)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Valid public ARM URL | ✅ passes |
| 2 | Azure Government Cloud URL | ✅ passes |
| 3 | Azure China Cloud URL | ✅ passes |
| 4 | Azure Germany Cloud URL | ✅ passes |
| 5 | `http://` non-HTTPS URL | ❌ throws "HTTPS" |
| 6 | Attacker host URL | ❌ throws "allowlist" |
| 7 | Invalid URL string | ❌ throws "Invalid LRO polling URL" |
| 8 | Empty string | ❌ throws "Invalid LRO polling URL" |
| 9 | Lookalike subdomain (`management.azure.com.attacker.com`) | ❌ throws "allowlist" |

**Total suite:** 42 tests passing (3 test files).
