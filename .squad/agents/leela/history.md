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
- v2 Sprint 1 chain: #474 (Nuke v1) → #475 (Harness types) → #476 (Registry + loaders)
- PR #544 (Step 1) APPROVED; PR #545 (Step 2) REQUEST CHANGES — 2 blockers outstanding
- DP #479 (Runner + SSE) APPROVE_WITH_CONDITIONS; 5 gated conditions locked
- DP Reviews archived: #475, #476, #477, #478 (all APPROVE_WITH_CONDITIONS; see history-archive.md)

## Active Sprint: v2 (harness + packs)

Sprint 1 blocking chain: **#474 → #475 → #476**. No Step 4+ work before #476 merges.
After #476: pack-core batch (#542, #503–#506, #478) → runner/SSE (#479, #480) → domain packs (#482–#488).
All open v2 issues should carry milestone **v2**.

## Learnings

- (2026-04-17T12:06:45.293Z) Sprint planning always required before backlog pickup when `.squad/identity/now.md` gate is active. Shortest v2 slice is harness spine, not pack work: `#474 → #475 → #476` must land before pack-core batch.
- (2026-04-17T03:30:17Z) DP #329: runtime duplication is the blocking risk — PoC adds `runtime/` inside `packages/mcp-server` that parallels `packages/web/api/` LLM client + session store. Third fork risk with SDK migration. Implementation issue must define canonical client before code lands.
- (2026-04-17T03:30:17Z) DP #330 closeout: Option B (hybrid route planner + manager agent) adopted. `phaseComplete`/`filesComplete` flags retired. Implementation sequence locked: Gate → arch spike → backend (#445, Bender) → UI (#446, Fry) → cleanup. Follow-ons #445 and #446 created.
- (2026-04-17T01:53:59Z) Review gate must be label-based, not GitHub approval-required, because repo owners cannot self-approve. `leela:approved` + `zapp:approved` labels drive `squad/review-gate` status check.
- (2026-04-17) Comment acknowledgment and thread resolution are non-optional — silently fixing code is a process violation. Reply to specific comment with SHA + description; resolve thread via GraphQL; verify 0 unresolved before merge.
- (2026-04-16T05:51:43.085Z) Design spikes producing DPs are process-compatible with sprint planning reset — blocking them on ceremony is circular. Spikes (DPs) run in parallel with ceremony.
- (2026-04-15T09:46:31.308Z) Issue #265 smallest ship: treat FileEditor payloads as workspace data, not chat bubble content. Paths: `chat-a2ui.ts`, `App.tsx`, `FileManager/`, `session-store.ts`.

## 2026-06-10 — DP Review #479 v2 Step 5: Runner + SSE

**Verdict:** APPROVE_WITH_CONDITIONS  
**GitHub comment:** https://github.com/sabbour/kickstart/issues/479#issuecomment-4268302933

- SSE 9-event taxonomy locked: `chunk | a2ui | tool | artifact | user_action_required | handoff | intent | done | error`. No envelope. `a2ui`/`chunk` separation canonical.
- Runner/registry coupling correct: read-only calls on sealed registry, per-turn `Agent` construction from `AgentContribution`.
- C1 (Phase A+B gate): Confirm `getToolsForAgent(agentName)` on #476 PackRegistry.
- C2 (Phase B gate): Drain `a2uiEmissions` immediately on each SDK `tool_call_item`; array is log, not stream.
- C3 (Phase C gate): Drop `resultSchema` from `SessionCtx.pendingUserAction`; use `registry.getUserAction().resultSchema` on resume.
- C4 (merge gate): Wire `useNavigation.ts` to `onIntent` — `onPhase` feed removed; hook must not be "untouched".
- C5 (Phase C gate): Clarify `/api/packs` playground scenario listing (Options A/B/C; pick one, document before Phase C).
- Zapp Critical 1–3 remain merge gates: session ownership check, resultSchema validation, playground env gate.
- Filed `leela-479-dp-review.md` → decisions inbox.

## 2026-06-10 — PR #545 Code Review (v2 Step 2)

**PR:** #545 — feat(v2): Step 2 — Harness primitives, all types + Zod schemas (Closes #475)  
**Verdict:** REQUEST CHANGES — 2 blockers (no `leela:approved` applied)

C1, C3, C4, C5 all pass. Two blockers:

1. **`SessionCtx.a2uiEmissions: A2UIMessageV09[]` missing** — `session.ts` exposes write-only `recordA2UIEmission()` but no readable array. Required by C2 and #477 F3/C2. Step 5 SSE forwarding reads this array.

2. **`Pack` has dual-registration model** — `agentsDir?: URL` and `agents?: AgentContribution[]` both present. Brief §11 resolves to dir-based only. Remove `agents?` and `skills?` inline arrays from `Pack`.

Non-blocking: `tsconfig.json` includes unneeded `DOM` lib; `index.ts` has stale `// TODO(Step 2)` header.  
Step 3 (#476) gated on this PR. Both fixes are small diffs.  
Decision filed: `.squad/decisions/inbox/leela-pr545-review.md`

## 2026-06-10 — DP Review #480 v2 Step 6: Skill Resolver

**Verdict:** APPROVE_WITH_CONDITIONS
**GitHub comment:** https://github.com/sabbour/kickstart/issues/480#issuecomment-4268325601
**Decision record:** `.squad/decisions/inbox/leela-480-dp-review.md`

Four-stage pipeline, runner hook placement, per-turn scope, "skip not stop" budget, empty result safety, and Step 7 boundary all correct.

- C1 (BLOCKER, Phase B): Glob `*` rule self-contradicts — Rule A says `*` doesn't cross `.`; Rule B says bare `*` matches all agents. Fix: explicit `if (pattern === "*") return true` short-circuit before glob processing, or adopt `micromatch { dot: true }`.
- C2 (BLOCKER, Phase C): `listSkills()` not in #476-approved accessor surface. Must lock against #476 before runner wiring.
- C3 (Required, Phase C): `estimateTokens` must be exported from harness `index.ts`; deep path imports will break.
- OQ2 answered: use last N turns of any role (not user-only).
- OQ3 answered: XML skill tags preferred over `---` separators.

## 2026-06-10 — DP Review #480 v2 Step 6: Skill Resolver

**Verdict:** APPROVE_WITH_CONDITIONS  
**GitHub comment:** #480

- Four-stage pipeline (glob filter → keyword score → priority sort → budget cap) approved.
- Runner hook inside `instructions: (_runCtx) => string` callback correct.
- C1 (BLOCKER Phase B): Fix `*` glob contradiction — add explicit `if (pattern === "*") return true;` short-circuit OR adopt `micromatch`/`minimatch` with `{ dot: true }`. Do NOT change generic glob segment rule (breaks `aks.*`).
- C2 (BLOCKER Phase C): Lock `listSkills()` vs `getSkillsForAgent()` against #476 before runner wiring. Either amend #476 spec to add `listSkills()` (Option A) or use already-mandated `getSkillsForAgent()` (Option B).
- C3 (Required Phase C): Export `estimateTokens` from harness `index.ts`; verify with `tsc --noEmit`.
- M1 (OQ2 answered): All roles (user + agent) for context window, not user-only.
- M2 (OQ3 answered): XML `<skill name="…">` tags for skills block injection, not `---` separators.
- Filed `leela-480-dp-review.md` → decisions inbox.

## 2026-06-10 — PR #546 Code Review (v2 Step 3)

**PR:** #546 — feat(v2): Step 3 — PackRegistry, loaders, frontmatter parser (Closes #476)  
**Verdict:** APPROVED — `leela:approved` applied

All DP #476 conditions verified: `yaml` npm package ✅, full 9-accessor read surface ✅, `UserActionContribution.wireName` dual-key indexing ✅, Zapp security conditions (pack namespaces, dep-scoped resolution, path confinement, iterative cycle detection, immutable `seal()`) ✅, `SessionCtx.a2uiEmissions: A2UIMessage[]` backported ✅. Build green, 53/53 tests passing.  
Non-blocking follow-ups: `enable()`-after-`seal()` missing guard, no dedicated `frontmatter.test.ts`, `wireName` auto-compute not enforced.  
**Unblocked:** Step 4 (pack-core), Step 4a (playground), Step 5 (runner pending `enable()` fix), #477 C2 resolved.  
Decision filed: `.squad/decisions/inbox/leela-pr546-review.md`

## 2026-06-10 — PR #545 Re-verification (v2 Step 2)

**PR:** #545 — feat(v2): Step 2 — Harness primitives (re-check after Bender's fixes)  
**Verdict:** APPROVED — `leela:approved` applied

Re-checked three previously-raised blockers against commits `96c675bb`, `4d1e5dc`, `427c385b`. All cleared: `Pack` is dir-based only (no inline `agents`/`skills` arrays) ✅, `SessionCtx.a2uiEmissions: A2UIMessage[]` present at `session.ts` ✅, `chat-a2ui.ts` maps legacy `handoff` → `assess` with test coverage ✅. No further architecture blockers.  
Decision filed: `.squad/decisions/inbox/leela-pr545-recheck.md`

## 2026-06-10 — PR #545 Re-verification

**PR #545 (Closes #475) — APPROVED — `leela:approved` applied**

Re-check after commits `96c675bb`, `4d1e5dc`, `427c385b`:
1. `Pack` inline arrays removed ✅ — no `agents?` or `skills?`; `agentsDir?`/`skillsDir?` dir-based only.
2. `SessionCtx.a2uiEmissions: A2UIMessage[]` present ✅ — #477 C2 prerequisite satisfied.
3. `chat-a2ui.ts` remap ✅ — `normalizeConversationPhase('handoff')` → `'assess'`; `'triage'` → `null`; tests pass.

Step 3 (#476 / PR #546) unblocked after this approval (pending Zapp security gate).  
Decision filed: `.squad/decisions/inbox/leela-pr545-recheck.md`

## 2026-04-17 — PRs #544, #545, #546 merged into v2-rewrite

Steps 1–3 of the v2 harness spine are shipped.
- **#544/#474 (Step 1):** Nuke v1, harness seam, web-shell cleanup. ✅ MERGED.
- **#545/#475 (Step 2):** Harness types + Zod schemas. Two-round review cycle (missing `a2uiEmissions`, dual-registration on `Pack`). ✅ MERGED after `96c675bb`/`4d1e5dc`/`427c385b` fixes.
- **#546/#476 (Step 3):** PackRegistry, loaders, frontmatter parser. Symlink confinement fix at `5c325db`. ✅ MERGED.

**Unblocked:** #477 Phases A+B (immediate), #478 (pending C2 pseudocode fix), #479 (after #477 C1 confirmed), #480 (authored + approved).
**Known debt:** `types.ts` tsc gap, `enable()`-after-`seal()` guard, frontmatter edge-case tests.

## 2026-04-17 — PR #547 (Closes #478) — Step 4a Playground on Registry — APPROVED

**Verdict: APPROVED** — `leela:approved` applied.

All four phases verified complete:
- Phase A: `GALLERY_GROUPS` / static scenario arrays gone; `registry.playgroundScenarios` + `groupByPack()` drives gallery. ✅
- Phase B: Widgets tab, `WidgetCard`, `WidgetPreview`, all widget state deleted. ✅
- Phase C: Components tab wired to `registry.components`, grouped by pack with empty state. ✅
- Phase D: `usePlaygroundDispatch` hook created; `if (!stub)` guard confirmed before error path (C2 ✅). Dormant until #477 stubs land — acceptable for Step 4a.

C1 (resolved pre-coding): `playgroundScenarios`, `playgroundStubs`, `components` from #476-confirmed surface all used. `getComponent` method not needed — array property sufficient.
M1: Empty scenario list = informational state; unregistered component ref = `GalleryCardErrorBoundary`. Distinct. ✅
No v1 imports. `TODO(Step 5)` markers precise. ✅

Decision filed: `.squad/decisions/inbox/leela-pr547-review.md`
Unblocks: #479 (Step 4b), #477 integration.

## 2026-04-17 — PR #547 Code Review (v2 Step 4a: Playground on registry)

**Closes:** #478  
**Verdict:** APPROVED — `leela:approved` applied

All four phases verified:
- Phase A: `GALLERY_GROUPS` removed; `registry.playgroundScenarios` + `groupByPack()` drives gallery. ✅
- Phase B: Widgets tab, `WidgetCard`, `WidgetPreview`, all widget state deleted. ✅
- Phase C: Components tab renders `registry.components` grouped by pack. ✅
- Phase D: `usePlaygroundDispatch` hook created; dormant until #477 stubs land (intentional). ✅

C1 resolved: `playgroundScenarios`, `playgroundStubs`, `components` from #476-confirmed surface used. `getComponent` not needed for iteration use case.  
C2 resolved: `if (!stub)` guard present with explicit comment crediting C2.  
M1: Empty scenario list → informational state; unregistered component → `GalleryCardErrorBoundary`. Correct.  

Unblocks: #479 (Step 4b) and pack-core integration (#477) once that PR merges.  
Decision filed: `.squad/decisions/inbox/leela-pr547-review.md`


## 2026-04-17 — PR #548 pack-core code review

Working as **Leela (Lead Architect)**.

Reviewed PR #548 (feat(v2): pack-core Phases A–H, closes #477). Checked all five DP conditions (C1–C5) against the actual implementation.

**C1** ✅ `corePack` uses `agentsDir`/`skillsDir` URL dir-pointers. No inline arrays.
**C2** ✅ `emit_ui` Zod-validates then calls `session.recordA2UIEmission()`. `SessionCtx.a2uiEmissions` confirmed in harness.
**C3** ✅ Noted for Step 5 DP: must forward from `session.a2uiEmissions`, not `event.arguments`.
**C4** ⚠️ Path bug in `agents.test.ts:26` — `../../agents` resolves to non-existent dir; should be `../agents`. All tests are `it.todo()` so non-blocking for merge; Hermes owns the fix on activation.
**C5** ✅ AuthCard schema stripped of Azure-specific props. Generic `providerLabel` string.

Scope: 3 agents ✅, 5 skills ✅, 6 tools wired ✅, 27 basic + 13 rich (40 total) ✅, 3 guardrails ✅. `search_components.ts` flagged as orphan (not wired in corePack).

Approved. `leela:approved` label applied. Decision filed to `.squad/decisions/inbox/leela-pr548-review.md`.
