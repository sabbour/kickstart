# E2E Cohesion Audit — Issue #228

**Auditor:** hermes (coordination/docs)  
**Date:** 2025-07-14  
**Branch:** `squad/228-cohesion-audit`  
**Status:** ✅ All HIGH/CRITICAL issues remediated; tests passing

---

## Executive Summary

| Category | Result | Issues Found | Fixed |
|---|---|---|---|
| AKS Automatic grounding | ⚠️ PARTIAL | 2 gaps (CNI/PSP anti-patterns, SKU constraints) | No — LOW severity |
| Handoff chain integrity | ✅ FIXED | azure.ops missing github.publisher; github.publisher missing core.reviewer | Yes |
| Tool surface drift | ✅ FIXED | assessAksClusterTool wrong namespace (CRITICAL); 1 dead-code tool | Critical fixed |
| Recipe coverage | ⚠️ GAP | 24 of 42 recipes unreferenced in any agent prompt | No — filed for follow-up |
| DynamicString coercion | ✅ FIXED | 4 components missing String() coercion | Yes |

**Net result:** The pre-existing `schema-conformance.test.ts` failure (100% broken azure pack) is resolved. All 97 schema-conformance tests now pass (was 0 of 97).

---

## Findings

### CRITICAL — Now Fixed

| # | Severity | File | Issue | Fix Applied |
|---|---|---|---|---|
| C1 | CRITICAL | `pack-azure/src/tools/assess-aks-cluster.ts` | `assessAksClusterTool` declared `name: 'core.assess_aks_cluster'` but registered in azure pack. `PackRegistry.normalizeTool()` at `registry.ts:438` validates tool names must start with `${pack.name}.`; mismatch caused entire azure pack to be silently quarantined at startup → `seal()` threw on every `core.triage → azure.architect` handoff → all 97 schema-conformance tests failed. | Renamed to `azure.assess_aks_cluster` in tool + test |

### HIGH — Now Fixed

| # | Severity | Agent/File | Issue | Fix Applied |
|---|---|---|---|---|
| H1 | HIGH | `azure-ops.agent.md` | No handoff to `github.publisher` — deployment flow had no path to publishing | Added `github.publisher` handoff |
| H2 | HIGH | `azure/server-manifest.ts` | No `handoffTargets: ['github']` — cross-pack handoff to github pack was unauthorized | Added `handoffTargets: ['github']` |
| H3 | HIGH | `github.publisher.agent.md` | `handoffs: []` — after publishing, no path back to `core.reviewer`; chain terminated silently | Added `core.reviewer` handoff |
| H4 | HIGH | `azure-architect.agent.md` | `azure.assess_aks_cluster` not in agent `tools:` frontmatter — tool registered but unavailable to architect agent | Added to tools list |
| H5 | HIGH | `SummaryCard.tsx` | `title`, `item.label`, `item.value` rendered without `String()` coercion — DataBinding/FunctionCall objects rendered as `[object Object]` | Added `String()` coercion |
| H6 | HIGH | `JobToBeDoneTable.tsx` | 6 DynamicString fields (`title`, `you_want`, `how_aks`, reshape/stay/exit labels) without coercion | Added `String()` coercion |
| H7 | HIGH | `ProgressSteps.tsx` | `step.label` rendered without coercion | Added `String(step.label)` |
| H8 | HIGH | `SteppedCarousel.tsx` | `step.title` rendered twice (indicator loop + active step title) without coercion | Added `String(step.title)` |

### MEDIUM — Deferred (file issues for follow-up)

| # | Severity | Area | Issue | Recommendation |
|---|---|---|---|---|
| M1 | MEDIUM | `pack-azure/src/tools/propose-services.ts` | `azure.propose_services` tool exists with correct namespace but is NOT imported/registered in azure server-manifest — dead code | Remove or add to manifest + agent tools list |
| M2 | MEDIUM | Agent tools frontmatter | 7 registered tools not declared in any agent: `core.show_form`, `core.confirm`, `core.navigate`, `core.check_safeguards`, `core.fix_safeguards`, `core.kustomize_build`, `azure.arm_update_resource` | Audit which agents should declare them; add or remove from manifest |
| M3 | MEDIUM | `aks-manifests-author` handoff chain | Author hands off only to `aks.architect` (back) or `core.reviewer` (skip) — no path to `core.codesmith`. Intended workflow: architect → manifests-author → codesmith → azure-ops | Verify intended chain; add `core.codesmith` handoff if desired |

### LOW — Noted, No Action

| # | Severity | Area | Issue |
|---|---|---|---|
| L1 | LOW | `aks.architect` / `aks.manifests_author` | No explicit kubenet CNI or Pod Security Policy anti-patterns in prompts (implicit via "AKS Automatic uses overlay CNI" framing) |
| L2 | LOW | `aks.architect` | No explicit Standard_D SKU family constraint — SKU selection delegated to quota check tool |
| L3 | LOW | `config/recipes.json` | 24 of 42 recipes not referenced by any agent: R4, R5, R10, R15, R18-R20, R-bulk-sequenced-PRs, R-canary-teardown, two-layer-rollback, and others — either stale or not yet integrated into agent prompts |

---

## Root Cause Analysis — CRITICAL Bug

The root cause of the pre-existing test failure was a tool namespace violation:

```
assess-aks-cluster.ts:197  name: 'core.assess_aks_cluster'   ← wrong pack prefix
azure/server-manifest.ts   registered in azure pack           ← correct pack
```

**Failure cascade:**
1. `PackRegistry.normalizeTool()` checks `tool.name.startsWith(pack.name + '.')` → throws for azure pack
2. `packs.ts:182-183` silently quarantines non-core pack failures → azure pack never registers
3. `seal()` validates `core.triage` handoffs → `azure.architect` not in registry → throws
4. All 97 schema-conformance tests fail at `buildRegistryWithHermeticCredentialEnv()`

**The fix:** rename the tool to `azure.assess_aks_cluster` — one string change that unblocks the entire azure pack.

---

## Handoff Chain (Post-Fix)

```
core.triage
  ├─→ azure.architect
  │     ├─→ aks.architect
  │     │     └─→ aks.manifests_author
  │     │           ├─→ aks.architect (revision loop)
  │     │           └─→ core.reviewer (terminal)
  │     └─→ azure.ops
  │           └─→ github.publisher  ← H1/H2 fixed
  │                 └─→ core.reviewer  ← H3 fixed
  └─→ core.reviewer (terminal)
```

---

## DynamicString Coercion Pattern

All four fixed components now follow the established pattern from `DiffPlan.tsx`:

```tsx
// Before (broken for DataBinding/FunctionCall values):
<span>{props.title}</span>

// After (safe for all DynamicString variants):
<span>{String(props.title)}</span>
```

`DynamicStringSchema = z.union([z.string(), DataBindingSchema, FunctionCallSchema])` — when LLM sends `{path: "foo"}` or `{call: "fn", args: {}}`, React renders `[object Object]` without coercion.

---

## Files Changed

| File | Change Type |
|---|---|
| `packages/pack-azure/src/tools/assess-aks-cluster.ts` | CRITICAL fix: rename tool namespace |
| `packages/pack-azure/src/tools/assess-aks-cluster.test.ts` | Test describe name updated |
| `packages/pack-azure/src/agents/azure-architect.agent.md` | Add `azure.assess_aks_cluster` to tools |
| `packages/pack-azure/src/agents/azure-ops.agent.md` | Add `github.publisher` handoff |
| `packages/pack-azure/src/server-manifest.ts` | Add `handoffTargets: ['github']` |
| `packages/pack-github/agents/github.publisher.agent.md` | Add `core.reviewer` handoff |
| `packages/pack-core/src/components/rich/SummaryCard.tsx` | DynamicString `String()` coercion |
| `packages/pack-core/src/components/rich/JobToBeDoneTable.tsx` | DynamicString `String()` coercion |
| `packages/pack-core/src/components/rich/ProgressSteps.tsx` | DynamicString `String()` coercion |
| `packages/pack-core/src/components/rich/SteppedCarousel.tsx` | DynamicString `String()` coercion |
