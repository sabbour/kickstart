# Decision — Leela Design Review #483: pack-aks-automatic

**Date:** 2026-04-17
**Author:** Leela (Lead)
**Issue:** #483 — v2 Step 8: pack-aks-automatic — agents, skills, safeguards, components, guardrails
**Verdict:** APPROVE_WITH_CONDITIONS

---

## Summary

The DP is architecturally sound on the `safeguards.json` data/code separation. Two blocking conditions must be resolved before code is written.

---

## Blocking Conditions

### C1 — Harness `Pack` type missing `skills?: Skill[]`

The actual shipped `Pack` interface (`packages/harness/src/types/pack.ts` as of PR #548) does NOT include a `skills?: Skill[]` field. `PackRegistry.loadSkills()` only walks `skillsDir` for `.md` files — there is no code path to register inline `Skill` objects.

The DP's `deployment-safeguards` skill requires dynamic body generation from `safeguards.json` at pack load time, which requires an in-memory `Skill` registration path.

**Resolution required before #523 ships:**
- Add `skills?: Skill[]` to `Pack` interface in `packages/harness/src/types/pack.ts`
- Extend `PackRegistry.loadSkills()` to merge `pack.skills ?? []` after file-walking
- Set `source: { kind: "inline" }` on programmatically built `Skill` objects
- The brief already specifies this field; the implementation simply didn't include it (scope gap in #477)

### C2 — `ArchitectureDiagram` already in pack-core (wrong pack)

PR #548 placed `ArchitectureDiagram.tsx`, `architectureDiagramIconRegistry.ts`, and `architectureDiagramUtils.ts` into `pack-core/src/components/rich/`, registering as `core/ArchitectureDiagram`. The v2 brief (§7 pack inventory) lists ArchitectureDiagram under `pack-aks-automatic` as `aks/ArchitectureDiagram`, not pack-core. Pack-core's rich component list in the brief does not include it.

The DP says "port from v1 catalog" — but the source has already moved to pack-core. The v1 catalog version at `packages/web/src/catalog/components/` is now superseded.

**Resolution required before #525 ships:**
- #525 implementer must MOVE (not copy) `ArchitectureDiagram.tsx`, `architectureDiagramIconRegistry.ts`, `architectureDiagramUtils.ts`, and their tests from `pack-core/src/components/rich/` to `pack-aks-automatic/src/components/`
- Remove the imports and registration from `pack-core/src/core-pack.ts`; adjust component count
- Re-register as `aks/ArchitectureDiagram` (name prefix changes from `core/` to `aks/`)
- Delete the v1 source at `packages/web/src/catalog/components/ArchitectureDiagram*`
- The #525 PR must include the pack-core modification — this is a cross-pack change, not just a port
- The porter owns this cleanup entirely — Hermes is not in scope for it

---

## Non-blocking Conditions

### C3 — `aks/DeploymentConfirm` component missing from all sub-issues

`aks:deploy` user action declares `confirmComponent: "aks/DeploymentConfirm"` but this component appears in no sub-issue's "Files affected." Add to #526's scope.

### C4 — `package.json` / `tsconfig.json` not assigned

The `pack-aks-automatic` package initialization (package.json, tsconfig.json) is not in any sub-issue. Add to #523.

### C5 — Zapp's Q2 must be answered before #524 ships

The deploy credential mechanism (re-use azure-auth token from pack-azure vs. new AKS-scoped token) determines the implementation of `deploy.ts`. Do not merge #524 until Zapp closes Q2.

---

## Architecture Findings

### `safeguards.json` — data/code separation is correct

No conflict with `GuardrailContribution`. `safeguards.json` is the rule data; `GuardrailContribution.check()` is TypeScript code that consumes it. The guardrail engine calls `check(ctx, payload)` — a typed async function — never JSON directly. The "single source of truth" claim is valid: three consumers (skill prose, tool validation, guardrail enforcement) all import the same JSON array. Zero duplication of rule definitions.

### Phase gating

| Phase | Can start when | Hard dependency |
|-------|---------------|-----------------|
| A+B: agent MD, SKILL.md, safeguards.json (#523) | Now | None (text files) |
| C: tools, user action (#524) | #477 types accessible | Harness types only |
| D: safeguards.json (in #523) | Now | None (data only) |
| E: ArchitectureDiagram port (#525) | C1+C2 resolved | #477 + pack-core modification |
| F+G: guardrails, remaining components, manifest (#526) | #477 + #482 merge | pack-azure needed for deploy |

### `aks:deploy` resultSchema

Present and complete: `{ status: "Succeeded" | "Failed", url?: string }`. Confirms deployment outcome, not just intent. Playground stub returns correctly shaped object. No change needed.

### Scope vs sub-issues

| DP Phase | Sub-issue | Coverage |
|----------|-----------|----------|
| A+B: agents, skills, safeguards.json | #523 | ✅ Covered |
| C: tools + user action | #524 | ✅ Covered (minus C5 credential Q) |
| E: ArchitectureDiagram port | #525 | ⚠️ Must address C2 |
| F+G: guardrails, components, manifest | #526 | ⚠️ Must add DeploymentConfirm (C3) |

---

## Q3 Answer — In-memory skills

**Not currently supported; harness patch required.** `PackRegistry.loadSkills()` only reads from `skillsDir` (file walk). The `Pack` interface has no `skills?: Skill[]` field in the shipped implementation. To support the `deployment-safeguards` skill being built at load time from `safeguards.json`, add `skills?: Skill[]` to `Pack` type and extend `loadSkills()` to merge them. This matches the brief's intent (the brief shows this field in the spec but it was omitted from #477's implementation). File as a micro-fix under #477 scope, implement in `squad/477-pack-core-test-scaffold` or equivalent.

## Q4 Answer — ArchitectureDiagram port ownership

**The #525 implementer owns the full cross-pack move.** The file was already ported from v1 catalog to pack-core in PR #548. The DP's premise ("port from catalog/") is outdated. #525 must move the files from pack-core to pack-aks-automatic, update both pack manifests, move tests, and delete the v1 source. Hermes is not involved. The PR must touch both `pack-core` and `pack-aks-automatic`.
