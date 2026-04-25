# Leela Review — PR #553 (Step 7: pack-azure)

**Date:** 2026-04-17  
**Verdict:** BLOCK  
**PR:** https://github.com/azure-management-and-platforms/kickstart/pull/553  
**Issue:** #482

---

## BLOCK Issues

### BLOCK-1 — C5 Violation: generic `azure:arm_write`
DP condition C5 explicitly prohibited a generic `azure:arm_write` user action. The implementation provides one with `method: enum(['PUT','PATCH','DELETE'])`, a free-form path, and untyped body. This is exactly what C5 rejected. Additionally, the landed user actions (arm_write, deploy, select_subscription) deviate from the approved DP list (login, create_subscription, pick_subscription, pick_region, pick_resource_group, deploy_bicep).

**Required:** Replace `azure:arm_write` with named, Zod-typed user actions per operation type. Remove the generic action.

### BLOCK-2 — Dead branch in `what-if.ts`
Both arms of the `isRgScope` ternary produce identical URLs. Subscription-scoped what-if requires a different ARM path. Silent bug — no test will catch it.

### BLOCK-3 — Typo in `no-privileged-operations.ts`
`/microsoft\.authorization\/denyas signments/i` has a literal space. Never matches `denyassignments`. The deny-assignment protection is silently broken.

---

## Conditions (pre-merge, non-blocking for re-review)

- **C-A:** `arm-get.ts` and `what-if.ts` duplicate token lookup inline. Use `getAzureToken()` from `azure-auth.ts`.
- **C-B:** `AzureAction` schema includes `userActionName` but component is declared display-only/passive. Remove if truly passive.

---

## What landed well

- All 5 tools have Zod input + output schemas ✅
- ARM path validation (Zapp C1) solid — 18 unit tests ✅
- `validate-bicep` uses static analysis (addresses Leela C4) ✅
- Token read from `context.tokens` in auth service ✅
- Guardrails implement `GuardrailContribution.check()` correctly ✅
- Pack manifest is a valid `Pack` object ✅
- Skill/agent frontmatter correct ✅
- Package wired into workspace ✅

---

## Next steps

Fry to fix BLOCK-1 through BLOCK-3 and address C-A/C-B, then re-request review.
