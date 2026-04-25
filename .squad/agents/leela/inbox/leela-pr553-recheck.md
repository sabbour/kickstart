# Leela — PR #553 Architecture Recheck

**Date:** 2026-04-17  
**PR:** https://github.com/azure-management-and-platforms/kickstart/pull/553  
**Fix commits reviewed:** c1ad322, 48958ab

## Result: APPROVED ✅

All original blocking conditions resolved.

## Block-by-block

### BLOCK-1 — Named user actions ✅
- `arm-write.ts` deleted from `user-actions/`
- Three named user actions present: `azure:deploy-resource`, `azure:delete-resource`, `azure:update-resource`
- Each has typed Zod `resultSchema`
- `index.ts` imports and registers all three in `userActions[]`
- `AzureActionSchema` has no `userActionName` prop (C-B also resolved)

### BLOCK-2 — what-if URL fix ✅
- Ternary branches are now distinct:
  - RG-scope: `...${safePath}/providers/.../whatIf?api-version=2021-04-01`
  - Sub-scope: same + `&%24expand=resourceChanges`
- `what-if.test.ts` (60 lines, 6 URL-path assertions) explicitly tests both branches and asserts `rgUrl !== subUrl`

### BLOCK-3 — Guardrail regex ✅
- Pattern: `/microsoft\.authorization\/denyassignments/i` — no space, correct

### C-A — Token dedup ✅ (with nit)
- `what-if.ts`, `arm-deploy-resource.ts`, `arm-delete-resource.ts`, `arm-update-resource.ts` all import `getAzureToken()` / `armAuthHeaders()` from `azure-auth.js`
- **Nit:** `arm-get.ts` still uses inline raw extraction (`session?.tokens?.['azure'] ?? session?.tokens?.['azure-token']`) — pre-existing, not a new regression, but should be cleaned up in a follow-up

### C-B — Dead prop ✅
- `AzureActionSchema` has no `userActionName` field
- Component renderer is clean
- Stale comment inside AzureAction mentions `azure:arm_write` — cosmetic, not functional

## Follow-up recommended (non-blocking)
- Migrate `arm-get.ts` inline token extraction to `getAzureToken()` to complete the canonical-token consolidation

— Leela (Lead Architect)
