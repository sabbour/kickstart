**Zapp — Security Review**

**Verdict: BLOCK**

### What I verified
- `arm_get` decodes before validation, uses a fully anchored allowlist, denies traversal/privileged segments, and `what_if` reuses the same validator (`packages/pack-azure/src/tools/arm-get.ts:24-33`, `packages/pack-azure/src/tools/what-if.ts:63-65`).
- `arm-get` tests cover the required attack vectors and pass locally (`packages/pack-azure/src/tools/arm-get.test.ts:31-69`, plus `npx vitest run packages/pack-azure/src/tools/arm-get.test.ts`).
- Azure tokens are read from the session token map (`packages/pack-azure/src/tools/arm-get.ts:79-83`, `packages/pack-azure/src/tools/what-if.ts:66-70`, `packages/pack-azure/src/services/azure-auth.ts:23-33`). I did not find token props/state in the Azure components, and `AzureAction` does not call ARM from the browser (`packages/pack-azure/src/components/AzureAction/index.tsx:8-21`, `126-139`).

### Blocking findings
1. **High — `azure:arm_write` is an over-broad mutation primitive with no C1-grade path validation.**
   - `packages/pack-azure/src/user-actions/arm-write.ts:14-31` exposes free-form `path`, `apiVersion`, and `body` fields behind one generic action.
   - The only guard in this PR is `require-subscription-scope`, which checks only for a `/subscriptions/{uuid}` prefix and otherwise passes (`packages/pack-azure/src/guardrails/require-subscription-scope.ts:12-18`, `31-59`). That is materially weaker than the anchored allowlist + denylist used for `arm_get` / `what_if`.
   - From a security standpoint this violates the repo’s narrow-schema / least-privilege rule: the model is being handed a generic ARM write surface instead of named, tightly typed mutation actions.

2. **Medium — privileged-path guardrail has a dead deny-assignment pattern.**
   - `packages/pack-azure/src/guardrails/no-privileged-operations.ts:15` uses `/microsoft\.authorization\/denyas signments/i` (embedded space), so `denyAssignments` will never match.
   - That leaves one privileged ARM resource family outside the intended blocklist.

### Notes
- C1 itself looks good in code and tests.
- I did not find `eval`, browser-side ARM fetch/XHR, or new unauthenticated pack endpoints in this PR.

**Required before Zapp approval**
- Replace `azure:arm_write` with named, narrowly typed write actions (or apply the same strict allowlist/denylist validation at the mutation boundary).
- Fix the `denyAssignments` guardrail typo and re-run the relevant tests.

— Zapp (Security Architect)
