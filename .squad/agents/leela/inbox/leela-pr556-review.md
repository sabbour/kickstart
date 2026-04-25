# Leela PR Review — #556: Step 8 pack-aks-automatic

**Date:** 2026  
**Reviewer:** Leela (Lead Architect)  
**PR:** https://github.com/azure-management-and-platforms/kickstart/pull/556  
**Verdict:** APPROVE_WITH_CONDITIONS

---

## Summary

The implementation is architecturally sound. All Zapp security conditions from the DP are met. The pack manifest, tools, user action, guardrails, and skills are well-structured and correctly registered. Two blocking conditions must be resolved before merge; three non-blocking observations.

---

## ✅ What's Correct

### Pack manifest (`index.ts`)
Valid `Pack` object. All registrations present: agents (dir), skills (dir), 2 tools, 1 userAction, 4 components, 3 guardrails. `name: 'aks'`, `version: '0.1.0'`, `dependsOn: ['core', 'azure']`. Clean and complete.

### `aks.validate_manifests`
- Uses `execFile` (not `exec`) with `['apply', '--dry-run=client', '-f', manifestPath]` — no string interpolation ✅
- Manifest written to temp file to avoid shell injection ✅
- Structured output: `{valid, errorCount, warningCount, diagnostics[], summary}` ✅
- Graceful degradation when kubectl absent (warning, not error) ✅
- Zapp's `execFile` condition: **met**

### `aks.validate_safeguards`
- Uses `createRequire(import.meta.url)` → static bundled JSON, not runtime file path ✅
- `Object.freeze()` on array + each rule at module init ✅
- Returns typed `{ruleId, severity, description, line?}[]` violations ✅
- `SAFEGUARD_RULES` exported as named export; accessible to guardrails as single source of truth ✅
- Zapp's "bundled import only, no runtime path" condition: **met**

### `aks:deploy` user action
- Confirm gate only: no `execute` function, `confirmComponent: { component: 'aks/DeploymentProgress' }` ✅
- `resultSchema` typed with `clusterName`, `resourceGroup`, `subscription` (all required) ✅
- `cancellation: 'supported'` ✅
- Zapp's typed resultSchema condition: **met**

### Guardrails (all 3)
- Correct interface: `GuardrailContribution` with `name`, `stage: 'tool'`, `appliesTo`, `check()` returning `GuardrailVerdict` ✅
- Returns `{ kind: 'pass' }` or `{ kind: 'block', reason }` ✅
- Fail-fast: null payload → `{ kind: 'pass' }` (nothing to check) — acceptable
- `isKubernetesManifest()` guard prevents false positives ✅
- `appliesTo: ['core.write_file', 'aks.*']` — broad but correct for defense-in-depth

### `safeguards.json`
- 8 rules with `{id, severity, description, check}` structure ✅
- Frozen at startup ✅
- Rules cross-referenced correctly in `evaluate-safeguards.ts` switch-case ✅

### Skills (7 SKILL.md)
- All have complete `x-kickstart` frontmatter: `id`, `keywords[]`, `priority`, `appliesTo[]` ✅
- Sample checked: `aks-networking` (priority 85), `aks-security` (90), `aks-identity` (85), `aks-monitoring` (70), `aks-scaling` (75)
- `appliesTo: ["aks.*"]` is correct scope ✅

### Package + workspace
- `@kickstart/pack-aks-automatic` in `package-lock.json` ✅
- Root workspace `"packages/*"` auto-includes it ✅
- `package.json` has correct `type: "module"`, exports, deps (`@kickstart/harness`, `@openai/agents`, `zod`) ✅

---

## 🔴 Blocking Conditions

### B1 — V1 ArchitectureDiagram source not deleted

`packages/web/src/catalog/components/ArchitectureDiagram.tsx`, `architectureDiagramUtils.ts`, `architectureDiagramIconRegistry.ts`, and their `.test.ts` files still exist in the v1 catalog tree.

DP C2 required: "Delete the v1 source at `packages/web/src/catalog/components/ArchitectureDiagram*`". This PR adds the component to `pack-aks-automatic` (good) but does not remove the v1 source (gap). Two canonical copies now exist.

**Required fix:** Delete:
- `packages/web/src/catalog/components/ArchitectureDiagram.tsx`
- `packages/web/src/catalog/components/architectureDiagramUtils.ts`
- `packages/web/src/catalog/components/architectureDiagramUtils.test.ts`
- `packages/web/src/catalog/components/architectureDiagramIconRegistry.ts`
- `packages/web/src/catalog/components/architectureDiagramIconRegistry.test.ts`

If any other file in `packages/web/src/` imports these, update those imports to use `@kickstart/pack-aks-automatic`.

### B2 — Temp directory leak in `validate-manifests.ts`

```ts
const dir = await mkdtemp(join(tmpdir(), 'aks-validate-'));
const manifestPath = join(dir, 'manifest.yaml');
try {
  await writeFile(manifestPath, yaml, 'utf8');
  // ...
} finally {
  await unlink(manifestPath).catch(() => undefined);
  // dir is never cleaned up ← BUG
}
```

`mkdtemp` creates a directory. `unlink` removes only the file. The directory leaks. Under load (many validations), this accumulates.

**Required fix:**
```ts
} finally {
  await unlink(manifestPath).catch(() => undefined);
  await rmdir(dir).catch(() => undefined);
}
```
Add `rmdir` to the `node:fs/promises` import line.

---

## 🟡 Non-blocking Observations

### N1 — PR description says "ported from pack-core" — incorrect

`pack-core/src/` has no `ArchitectureDiagram` files on `main`. The port was from `packages/web/src/catalog/components/`. The description is misleading. Update the PR description to read "ported from v1 catalog (`packages/web/src/catalog/components/`)". Low impact but reviewers and git history readers will be confused.

### N2 — `Pack.name: 'aks'` vs expected `'aks-automatic'`

The review checklist specified `aks-automatic` to avoid future namespace collision. Using `'aks'` is cleaner and consistent with the shortname convention (`core`, `azure`). This is acceptable, but the checklist intent was to prevent a future `pack-aks-legacy` or similar from clashing. If a second AKS pack is ever added, the name collision risk is real. Document in PR description that `name: 'aks'` is the intentional canonical short name.

### N3 — `aks/DeploymentConfirm` (DP C3) resolved differently

DP C3 said to add `aks/DeploymentConfirm` as the confirmComponent. Implementation uses `aks/DeploymentProgress` instead. The component exists and is registered. The naming diverges from the DP but the functionality is correct. Acceptable — note the deviation.

---

## Architecture Sign-offs

| Check | Status |
|-------|--------|
| `execFile` args array (no shell injection) | ✅ |
| `safeguards.json` frozen at startup | ✅ |
| `aks:deploy` confirm gate with typed resultSchema | ✅ |
| Tools return structured output | ✅ |
| Guardrails implement `check()` returning `pass\|block` | ✅ |
| Pack name unique | ✅ (as `'aks'`) |
| Skills have correct frontmatter | ✅ |
| Workspace registered | ✅ |
| V1 source deleted | ❌ B1 |
| Temp dir cleanup | ❌ B2 |

---

_Leela (Lead Architect) — decision filed to `.squad/agents/leela/inbox/leela-pr556-review.md`_
