# Leela — Lead

## About Me
Lead engineer and architect. Owns roadmap prioritization, design reviews, technical decisions, and team coordination. Expert in process governance, architecture patterns, and escalation handling. Responsibility: ensure all work follows DP gate, security approval, and quality standards before shipping.

## Key Files
- `.squad/team.md` — team roster and capability profiles
- `.squad/ceremonies.md` — ceremony definitions and triggers
- `.squad/decisions.md` — canonical architecture decisions (last 5 kept here, older archived)
- `docs/architecture.md` — architecture overview and patterns guide
- `.squad/routing.md` — issue assignment and team boundaries

## Patterns
- **DP 3-step gate:** Issue → Design Proposal (on issue, not PR) → Leela + Zapp review → code implementation
- **PR discipline:** One PR per issue, design already approved, code review secondary
- **No-lockout directive:** Original author handles all post-review feedback
- **Wave structure:** Wave 1 (foundations), Wave 2 (integration), Wave 3 (E2E), Wave 4 (release)
- **Process directives:** Always stored in .squad/decisions/inbox/ for Scribe merge; not versioned inline

## Recent Work
- v2 Steps 1–4a MERGED (PRs #544/#545/#546/#547). Step 4 pack-core in PR #548.
- PR #548: Leela APPROVED (`leela:approved`); Zapp BLOCKED (3 high security findings). Bender fix cycle in progress.
- DP #479/#480 approved with conditions; downstream of #477/#478.

## Active Sprint: v2 (harness + packs)

Merged chain: **#474✅ → #475✅ → #476✅ → #478✅**  
In review: **#477** (PR #548) → #479 → #480 → domain packs (#482–#488)  
All open v2 issues should carry milestone **v2**.

## Learnings

- (2026-04-17T12:06:45.293Z) Sprint planning always required before backlog pickup when `.squad/identity/now.md` gate is active. Shortest v2 slice is harness spine, not pack work.
- (2026-04-17T03:30:17Z) DP #329: runtime duplication is the blocking risk — third fork risk with SDK migration. Implementation issue must define canonical client before code lands.
- (2026-04-17T03:30:17Z) DP #330 closeout: Option B (hybrid route planner + manager agent) adopted. `phaseComplete`/`filesComplete` flags retired.
- (2026-04-17T01:53:59Z) Review gate must be label-based, not GitHub approval-required, because repo owners cannot self-approve. `leela:approved` + `zapp:approved` labels drive `squad/review-gate` status check.
- (2026-04-17) Comment acknowledgment and thread resolution are non-optional — silently fixing code is a process violation.
- (2026-04-16T05:51:43.085Z) Design spikes producing DPs are process-compatible with sprint planning reset — blocking them on ceremony is circular.
- (2026-04-15T09:46:31.308Z) Issue #265 smallest ship: treat FileEditor payloads as workspace data, not chat bubble content.

## 2026-04-17 — PRs #544 / #545 / #546 merged (Steps 1–3)

Steps 1–3 of the v2 harness spine shipped into v2-rewrite:
- **#544/#474 (Step 1):** Nuke v1, harness seam, web-shell cleanup. ✅ MERGED.
- **#545/#475 (Step 2):** Harness types + Zod schemas. Two-round review. ✅ MERGED.
- **#546/#476 (Step 3):** PackRegistry, loaders, frontmatter parser. Symlink fix at `5c325db`. ✅ MERGED.

Known debt: `types.ts` tsc gap (Step 2), `enable()`-after-`seal()` guard (Step 3), frontmatter edge-case tests.

## 2026-04-17 — PR #547 APPROVED (Step 4a, Closes #478)

Playground on registry. Phases A–D verified. `leela:approved` applied. PR #547 merged → v2-rewrite.
Unblocks: #479 (Step 4b), #477 pack-core integration.

## 2026-04-17 — PR #548 pack-core code review (Closes #477)

Working as **Leela (Lead Architect)**.

**C1** ✅ `corePack` uses `agentsDir`/`skillsDir` URL dir-pointers. No inline arrays.
**C2** ✅ `emit_ui` Zod-validates then calls `session.recordA2UIEmission()`. `SessionCtx.a2uiEmissions` confirmed in harness.
**C3** ✅ Noted for Step 5 DP: must forward from `session.a2uiEmissions`, not `event.arguments`.
**C4** ⚠️ Path bug in `agents.test.ts:26` — `../../agents` should be `../agents`. Non-blocking (all `it.todo()`); Hermes owns fix on activation.
**C5** ✅ AuthCard schema stripped of Azure-specific props. Generic `providerLabel` string.

Scope: 3 agents ✅, 5 skills ✅, 6 tools ✅, 40 components (27+13; ArchitectureDiagram bonus accepted) ✅, 3 guardrails ✅.
`search_components.ts` orphan flagged — must be wired or removed before merge.
`registration.test.ts` mock must use real import when Hermes activates.

**`leela:approved` applied.** Zapp security review pending; PR currently blocked by Zapp (3 findings: workspace symlink confinement, SSRF, guardrail enforcement).
Filed: `.squad/decisions/inbox/leela-pr548-review.md`

## 2026-04-17 — DP Review #482 pack-azure (Step 7)

Working as **Leela (Lead Architect)**.

Reviewed DP for #482 (v2 Step 7: pack-azure — agents, skills, tools, user actions, and components). Author: Fry.

**Verdict: APPROVE_WITH_CONDITIONS** — 5 conditions.

| Condition | Summary |
|-----------|---------|
| C1 | `auditLog` not a harness primitive — align with Bender on `SessionCtx` API before implementing |
| C2 | `azure/Login` must use pack-core `AuthCard` (generic) rather than re-porting `AzureLoginCard` |
| C3 | Phase gating must be explicit: A+B now, C+E after #477+#476, D after #479 |
| C4 | `validate_bicep` shell-out — switch to `@azure/bicep-node` or document `az` as deployment dep |
| C5 | No generic `azure:arm_write`; ARM writes need named per-operation user actions |

Answered all 5 of Fry's open questions:
- Q1: Keep single `arm_get` (collection paths allowed by regex)
- Q2: `deploy_bicep` calls ARM directly server-side; no new harness route
- Q3 → C5: Named user actions per write op; `azure/Action` is confirm-gate only
- Q4: Module-level icon registration (lazy); no `onRegister` hook in PackRegistry
- Q5: `azurePlaygroundStubs` named export in `playground/stubs.ts`; no `Pack` type change

ARM tool security (Zapp C1 pre-addressed): 3-layer defence on `arm_get`+`what_if` is sound. Only concern is `auditLog` API surface (C1).

Comment posted: https://github.com/sabbour/kickstart/issues/482#issuecomment-4268990865
Decision filed: `.squad/decisions/inbox/leela-482-dp-review.md`

---

## DP Review — #483 v2 Step 8: pack-aks-automatic

**Date:** 2026-04-17
**Verdict:** APPROVE_WITH_CONDITIONS

Blocking conditions (C1, C2):
- C1: `Pack` interface missing `skills?: Skill[]`; `PackRegistry.loadSkills()` is file-only. Harness micro-fix required before #523 ships. Brief has the field; #477 implementation dropped it.
- C2: `ArchitectureDiagram` already landed in pack-core (PR #548) as `core/ArchitectureDiagram`. Brief says it belongs in pack-aks-automatic as `aks/ArchitectureDiagram`. #525 must do a cross-pack move (not a port from v1 catalog).

Non-blocking: DeploymentConfirm missing from sub-issues (C3), package init not assigned (C4), Zapp Q2 must close before #524 (C5).

Q3 answered: In-memory skills not supported yet; harness patch (C1) unblocks them. Once fixed, register `deployment-safeguards` as inline `Skill` — no .md file or codegen needed.
Q4 answered: #525 implementer owns cross-pack move of ArchitectureDiagram from pack-core → pack-aks-automatic. Hermes not involved.

Comment posted: https://github.com/sabbour/kickstart/issues/483#issuecomment-4269251949
Decision filed: `.squad/decisions/inbox/leela-483-dp-review.md`

## 2026-04-17 — DP #483 pack-aks-automatic Review

**Verdict:** APPROVE_WITH_CONDITIONS (2 blocking, 3 non-blocking)

**C1 (BLOCKING):** Harness `Pack` type missing `skills?: Skill[]` — `PackRegistry.loadSkills()` only file-walks `skillsDir`; no inline Skill registration path exists. Must add field to `Pack` interface + extend `loadSkills()` to merge `pack.skills ?? []`. File as micro-fix under #477 scope.

**C2 (BLOCKING):** `ArchitectureDiagram` already in pack-core (registered as `core/ArchitectureDiagram`), not in pack-aks. #525 must MOVE files from `pack-core/src/components/rich/` to `pack-aks-automatic/src/components/`, re-register as `aks/ArchitectureDiagram`, remove from `core-pack.ts`.

**C3 (non-blocking):** `aks/DeploymentConfirm` missing from sub-issues — add to #526 scope.

**C4 (non-blocking):** `pack-aks-automatic` package.json/tsconfig.json unassigned — add to #523 scope.

**C5 (non-blocking):** Deploy credential mechanism (re-use azure-auth vs new AKS-scoped token) must be answered before #524 ships.

Architecture verdict: `safeguards.json` data/code separation correct; phase gating table accepted; `aks:deploy` resultSchema complete.
Decision filed: `.squad/decisions/inbox/leela-483-dp-review.md`
