# Fry — PR #553 Fix Report

**Date:** 2025-01-17  
**Branch:** squad/482-pack-azure  
**Commit:** c1ad322  
**PR:** #553 (pack-azure, Step 7)

---

## Zapp Security Review — Additional Fix (commit 48958ab)

**Zapp High: free-form path/body bypasses C1 ARM validation**

Added three server-side ARM executor tools with full `validateArmPath` (decodeURIComponent → `ARM_PATH_RE` allowlist → `ARM_PATH_DENY` denylist) applied to every path parameter before any ARM network call:

| Tool | Method | File |
|------|--------|------|
| `azure.arm_deploy_resource` | ARM PUT | `src/tools/arm-deploy-resource.ts` |
| `azure.arm_delete_resource` | ARM DELETE | `src/tools/arm-delete-resource.ts` |
| `azure.arm_update_resource` | ARM PATCH | `src/tools/arm-update-resource.ts` |

Each tool also uses `getAzureToken()` and `armAuthHeaders()` from `azure-auth.ts`, and handles ARM LRO via `pollArmLro()`. All three are registered in `index.ts`.

Added 9 Zapp C1 path-validation test cases for the executor tools in `arm-get.test.ts`.

**Tests: 33 passed (27 arm-get + 6 what-if). Build: clean.**

---

## All 5 Issues Addressed (commit c1ad322)

### 🔴 BLOCK-1 — Named per-operation user actions (C5 violation)
- **Deleted** `src/user-actions/arm-write.ts` (generic `azure:arm_write`)
- **Created** `src/user-actions/deploy-resource.ts` → `azure:deploy-resource` (ARM PUT, typed `resourcePath`, `resourceType`, `resourceName`, `body`, `confirmationMessage`)
- **Created** `src/user-actions/delete-resource.ts` → `azure:delete-resource` (ARM DELETE, typed fields, `destructive: true` in confirmComponent props)
- **Created** `src/user-actions/update-resource.ts` → `azure:update-resource` (ARM PATCH, typed `patch` delta)
- **Updated** `src/index.ts` to register/export the three new actions

### 🔴 BLOCK-2 — what-if URL dead-branch fixed
- **File:** `src/tools/what-if.ts` lines ~65–69
- RG scope URL: `.../resourceGroups/{rg}/providers/Microsoft.Resources/deployments/{name}/whatIf?api-version=2021-04-01`
- Subscription scope URL: `.../subscriptions/{sub}/providers/Microsoft.Resources/deployments/{name}/whatIf?api-version=2021-04-01&%24expand=resourceChanges`
- The two branches now produce distinct URLs (subscription scope adds `$expand=resourceChanges`)
- **Added** `src/tools/what-if.test.ts` with 6 tests verifying both URL paths

### 🔴 BLOCK-3 — Guardrail regex typo fixed
- **File:** `src/guardrails/no-privileged-operations.ts` line 17
- `/microsoft\.authorization\/denyas signments/i` → `/microsoft\.authorization\/denyassignments/i`
- Deny-assignment protection is now functional

### ✅ C-A — Token key deduplicated
- **File:** `src/tools/what-if.ts`
- Removed inline unsafe-cast chain (`tokens?.['azure'] ?? tokens?.['azure-token']`)
- Now uses `getAzureToken(session)` from `azure-auth.ts`

### ✅ C-B — Dead `userActionName` prop removed
- **File:** `src/components/AzureAction/index.tsx`
- Removed `userActionName: z.enum(['azure:arm_write', 'azure:deploy'])` from `AzureActionSchema`
- Removed usage in button text (`props.userActionName.replace(...)`) — button now shows generic "Confirm"
- Component is correctly passive/display-only with no action dispatch coupling

---

## Test Results

```
✓ packages/pack-azure/src/tools/what-if.test.ts  (6 tests) 4ms
✓ packages/pack-azure/src/tools/arm-get.test.ts  (18 tests) 6ms

Test Files  2 passed (2)
     Tests  24 passed (24)
```

Build: clean (`tsc` exits 0)

---

— Fry (Full-Stack Dev)
