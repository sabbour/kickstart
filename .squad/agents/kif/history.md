# Kif — History & Learnings

## Project Context
Kickstart — AI-guided AKS onboarding. v2 on `@openai/agents` SDK with harness + packs architecture.
Repo: azure-management-and-platforms/kickstart
User: Ahmed Sabbour

---

## Ceremony Updates (Most Recent)

## Ceremony: CI Diagnosis — PR #246 (kif-fix-ci-246, 2026-04-28)

- **Ceremony:** kif-fix-ci-246
- **Time:** 2026-04-28T19:12:30Z
- **Role:** DevOps / Platform
- **Status:** ✅ DIAGNOSED — escalated to Bender + Fry

### Root Cause
`TypeScript check (web)` step fails with ~25 errors in `packages/web && npx tsc --noEmit`.
Errors: `ZodObject<…> missing properties from ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>`.

**Cause:** Split Zod installation in the monorepo:
- `node_modules/zod@4.3.6` (root, used by harness/pack-aks/pack-azure/pack-github/@openai/agents)
- `packages/web/node_modules/zod@3.25.76` (separate copy for web)
- `packages/pack-core/node_modules/zod@3.25.76` (separate copy for pack-core)

`zod@3.25.76` is the Zod v4 bridge release. Two separate copies → two different `Symbol()` instances → TypeScript nominal type mismatch across project references.

**Compounding factor:** Both `packages/pack-core/src/skills/gen-gha-workflow/schema.ts` and `packages/web/src/vendor/a2ui/web_core/basic_catalog/functions/basic_functions_api.ts` use `z.preprocess` which was removed in Zod v4. A simple npm override won't suffice — code migration is required first.

### NOT the cause
- Kif's AJV CI step (`0169ae5e`) — workflow-only change, no TypeScript
- Bender's `microsoft-skills-loader` (`41699a1a`) — no component/package.json changes

### Action Taken
- Diagnostic comment posted on PR #246 (comment ID: 4338425798, post-flight: OK)
- Escalated to Bender (gen-gha-workflow schema.ts) and Fry (basic_functions_api.ts)

### Fix Pattern (SKILL candidate)
**"Monorepo split-Zod: v4 nominal type incompatibility"**
1. Fry: migrate `z.preprocess` → Zod v4 in `packages/web` vendor code
2. Bender: migrate `z.preprocess` → Zod v4 in `packages/pack-core/skills/gen-gha-workflow`
3. Kif: add `"overrides": { "zod": "4.x.x" }` to root `package.json`, update lockfile, push
4. Verify `cd packages/web && npx tsc --noEmit` passes locally before pushing



---

## 2026-04-28 — Ceremony: phase-2.0-prep-243-244-242

**Status:** ✅ COMPLETE — consolidated #242, post-flight exit 0

**Task:** Consolidate issue #242 (both post-flight defects from #197 ceremony post-flights: Fry exit-3 + Leela exit-2). Retitle for broader scope, bump priority p2→p1, expand scope beyond issue-edit kind to all post-flight-check.mjs gaps. Post comment and confirm bot identity.

**Outcome:**
- Issue #242 retitled: "P1: post-flight-check.mjs governance gaps (issue-close + pr-review kinds)"
- Priority bumped p2 → p1
- Scope expanded: identified pattern of incomplete kind-handling across the script
- Comment: https://github.com/azure-management-and-platforms/kickstart/issues/242#issuecomment-4337958473
- Post-flight check: exit 0, bot identity confirmed (squad-devops[bot], Bot type)
- Ceremony context: phase-2.0-prep-243-244-242

**Pattern insight:** Two unrelated ceremonies (Fry's, Leela's) hit the same script gap independently. This convergence signals the gap is fundamental and needs systematic audit + fix before post-flight trust is restored to governance gates.


## 2026-04-28: Post-Flight Gap Alert — Label-Event Lookup

- **Ceremony:** design-review-243-244  
- **Alert:** Zapp's post-flight check returned exit 3 on label-event API lookup. Labels were manually API-verified (no security failure); labels correctly applied to issues.  
- **Recommendation:** Consolidate this gap with the two previously identified post-flight gaps in #242 (Kif's CI/CD coordination task). Label-event lookup now represents the third post-flight gap class.  
- **Action Item:** Consider folding into #242 as a cross-post-flight enhancement (generic label-event resolver, standardized post-flight retry logic).


## Phase 2.0 — Workflow Governance Finding (2026-04-28)

**Two follow-ups pending:**

1. **PR #246 CI step:** Apply AJV validation step to `ci.yml` per spec in PR body. Backend bot lacks `workflows` scope; manual application required. Step uses Node.js heredoc, `$defs`→`definitions` rewrite for AJV v6, `{ format: 'full', schemaId: 'auto' }`.

2. **Issue #242 post-flight gap:** Label-event lookup third gap, pending clarification from prior Scribe batch.

**Context:** GitHub App permission boundary discovered — this is a real platform constraint affecting bot automation, worth documenting in team decisions for future workflow extensions.

## 2026-04-28 — Platform Follow-Ups: Workflows Scope Boundary + Convergent Post-Flight Gap Pattern

### Context
- **Task A:** PR #246 (squad-backend closes #243) blocked on AJV CI step—Bender's bot lacks `workflows` scope to commit to `.github/workflows/ci.yml`
- **Task B:** Issue #242 surfaced 2 post-flight-check.mjs bugs in one day; discovered a third during this ceremony (label-event lookup)
- **Ceremony:** `kif-platform-followups` — autonomous platform follow-ups while Leela decides on larger governance questions

### Findings

1. **Workflows Scope Boundary (Hard Limit)**
   - GitHub App role-based permissions are **per-resource**. The squad-backend app has `contents:write` but NOT `workflows:write`
   - Workflows updates **must** come from the platform bot (squad-platform), not from product bots
   - This is not a trust issue; it's an API boundary. Enforce it as a check: if a PR modifies `.github/workflows/**`, auto-assign to squad-platform for review + commit
   - **Implication:** platform bot is the workflows arm of squad. Document this in `.squad/decisions.md`

2. **Post-Flight Gap Pattern — Now 3 in One Day (P1 Governance)**
   - All 3 bugs stem from **incomplete contract** for post-flight-check.mjs:
     - Exit codes not documented (exit 3 mystery)
     - Event-kind handlers missing events (issue-edit missing `closed`)
     - Label operations have no actor-verification model (exit 3 fallback)
   - **Pattern insight:** The script started as a single-purpose tool (commit verification); grew incrementally to handle many kinds (comment, review, issue-edit, etc.). Each new kind exposed gaps in the contract.
   - **Lesson:** Post-flight is now a governance bottleneck. All 3 bugs are *process* failures, not code bugs—they're symptom of incomplete specification
   - **Recommendation:** Treat post-flight.mjs as critical infrastructure; spec first, code second. Every new kind gets a full contract (exit codes, event filter, test case) before merge

3. **Convergent Ceremony Anti-Pattern**
   - Bug 1 + Bug 2 + Bug 3 all discovered *during* ceremonies trying to verify other work
   - They appear **urgent** because they block ceremony progress, but they're actually **scope-creep symptoms**
   - **Recommendation:** Establish a post-flight "review gate" separate from ceremony flow. Run post-flight checks *after* ceremony success, not *as part of* ceremony flow. Ceremony author sees "post-flight pending" status but ceremony completes

### Completed

**Task A — PR #246 AJV Step:**
- Pulled 243 worktree, edited `.github/workflows/ci.yml`, inserted AJV validation step after Unit tests (per Bender's spec from PR #246 body)
- Commit: `0169ae5e` with co-author Copilot
- Pushed to squad/243-microsoft-skills-schema
- Posted comment to PR #246 (https://github.com/azure-management-and-platforms/kickstart/pull/246#issuecomment-4338230013)
- Post-flight: commit ✓, comment ✓

**Task B — Issue #242 Expansion:**
- Expanded #242 body to include Bug 3 (label-event lookup limitation)
- Added decision requirement: Option A (document limitation) vs Option B (implement via events API)
- Posted follow-up comment (https://github.com/azure-management-and-platforms/kickstart/issues/242#issuecomment-4338241261)
- Post-flight: issue-edit ✓, comment ✓

### Bot Identity Role
- Platform bot (squad-platform) now owns the workflows layer and post-flight verification layer
- Bender (backend) writes the code and schemas; Kif applies them to CI/CD
- This is a **functional partition** of the squad, not a permission issue—both are needed, different scopes

### Next (Not In Scope)
- Leela decides on Bug 3 label-actor model (Option A vs B)
- Scribe folds post-flight gaps into central `.squad/decisions.md`
- Amy updates ceremony spec docs if post-flight verification model changes

## Ceremony: PR Review Gate #245 + #246 (2026-04-28)

- **Ceremony:** pr-gate-245-246-plus-kif
- **Time:** 2026-04-28T11:56:56Z
- **Role:** DevOps / Platform
- **Status:** ✅ COMPLETE
  - **Task A:** Applied AJV ci.yml step on PR #246 (commit 0169ae5e394d133afe24818f6d3623e711b4356f)
    - AJV v6 compatibility shim ($defs→definitions rewrite)
    - PR comment posted
  - **Task B:** Expanded issue #242 to 3 bugs (added label-event-lookup gap)
    - Follow-up comment posted
  - **Decision:** Workflows scope boundary decision finalized
    - NEW: squad-platform[bot] owns all `.github/workflows/**`
    - Applied to .squad/decisions.md
    - All team members notified


## 2026-04-28 — Skill correction needed (z.preprocess in Zod v4)

**Ceremony:** DR #247 code review  
**Source:** Nibbler comment #4338584960

`.squad/skills/zod-monorepo-split/SKILL.md` needs correction:
- **Current (wrong):** "z.preprocess is removed in Zod v4"
- **Correct:** "z.preprocess exists in Zod v4 but returns `ZodPipe<ZodTransform<A,B>, U>` instead of `ZodEffects`. Return type is a breaking change for callers; runtime API is stable."

**Action:** Update SKILL.md before next Zod migration work. Bender to coordinate timing.

# Kif — History

## Project Context
Kickstart — AI-guided AKS onboarding. v2 on `@openai/agents` SDK with harness + packs architecture.
Repo: azure-management-and-platforms/kickstart
User: Ahmed Sabbour

## Background
Kif joined the team to own the DevOps and CI/CD layer. The squad was previously experiencing:
- PR review dismissals caused by Amy (docs agent) committing to PR branches after reviewers approved
- Workflow redundancy: squad-docs-gate.yml and squad-review-gate.yml both firing on same PR events (~4,059 min/week)
- squad-label-enforce.yml was deleted; issue-namespace enforcement (go:, release:, type:, priority:, estimate:) was lost as a side effect
- Mutual exclusivity for reviewer labels (approved/rejected) was folded into squad-auto-merge.yml

## Learnings

### 2026-04-27 — DevOps bottleneck audit

**Core finding:** Squad's ceremony overhead was designed for multi-agent coordination. When Ahmed works directly with a single Copilot session, those ceremonies add 3-6 hours of friction to changes that take 30 min to implement. The system optimizes for parallel multi-agent coordination that isn't actually happening.

**Structural redundancy discovered:**
- 5 workflows can independently add items to the project board: `squad-triage`, `squad-issue-assign`, `squad-project-sync`, `squad-heartbeat`, `squad-project-board-automate`. All idempotent, all burning minutes.
- 2 of those (triage + issue-assign) hardcode project `#3` instead of using `SQUAD_PROJECT_NUMBER` variable — config drift risk.
- `squad-review-gate` fires on `synchronize` (every push) even though gate result is deterministic until labels change.
- `squad-auto-merge` fires on both `labeled` and `workflow_run: [CI, Squad Review Gate]` completions — double-trigger pattern on the happy path.
- `squad-visible-trail` fires on every issue/PR label event with no early-exit guard for irrelevant labels.

**Ceremony math for a typical S-size fix:**
- DP write: ~30 min. DR (Leela + Zapp approval): ~30-60 min. Wait time between sessions: ~15-60 min.
- Total pre-code overhead: 1-2 hours for a ≤2h task. The ceremony exceeds the work.

**The Copilot-is-faster gap is structural, not accidental.** Squad adds governance coordination overhead proportional to team size. With one developer + one Copilot session, the coordination is self-referential — Ahmed is both product owner AND reviewer, so the multi-reviewer gates he's waiting on are sessions he has to spawn himself.

**Key pattern:** The most valuable Squad components for a solo-developer workflow are: CI, secret scan, review-gate (as merge guard), auto-merge, velocity reporting. The most cost-heavy relative to value: DP ceremony for S-size work, synchronous DR before coding, multi-reviewer PR gate for chore/bug-fix paths.

**Recommendations actioned in decisions inbox:** See `kif-devops-bottleneck-audit.md`.

### 2026-04-27 — Fast lane implementation

**Changes shipped:**

1. **ceremonies.md** — Added "Minimum Ceremony Path" reference table after ceremony overview. Added Fast Lane exemption (`estimate:S` or `squad:chore-auto`) to both DP and DR sections. Added Parallel DR mode for `estimate:M`: post DP, start coding, DR reviewers run concurrently; blockers resolved before PR opens. No hard time window — with Ralph running continuously, reviewers respond in minutes.

2. **squad-review-gate.yml** — Removed `synchronize` from `on.pull_request.types`. Gate is label-driven and deterministic; firing on every push was ~50 wasted runs/week.

3. **squad-triage.yml** + **squad-issue-assign.yml** — Removed "Add issue to project board" steps from both. Both hardcoded `projectNumber = 3` (config drift risk). `squad-project-board-automate.yml` is the authoritative handler.

4. **squad-heartbeat.yml** — Removed "Add triaged issues to project board" step. Ralph adds `squad:*` labels, which trigger `squad-project-board-automate.yml` on the label event — the heartbeat step was a duplicate add. Note: heartbeat has SYNC comment pointing at 3 template files; templates NOT touched — `squad upgrade` required to propagate.

5. **squad-visible-trail.yml** — Added label/branch guards to `issue-trail` and `pr-trail` job `if:` conditions. Skips runs where no `squad:*` label or `squad/` branch is present (~60-70% of event volume).

**Issues found but not fixed:**
- `squad-heartbeat.yml` template sync: 3 additional template file locations exist per the SYNC comment. Only `.github/workflows/squad-heartbeat.yml` was modified. Template propagation deferred to `squad upgrade`.
- `squad-auto-merge.yml` double-trigger (labeled + workflow_run): not in scope for this change set; tracked in prior bottleneck audit.
### 2026-04-27 — Actions minute reduction: merge docs-gate, add label filters

**Core finding:** Squad's ceremony overhead was designed for multi-agent coordination. When Ahmed works directly with a single Copilot session, those ceremonies add 3-6 hours of friction to changes that take 30 min to implement. The system optimizes for parallel multi-agent coordination that isn't actually happening.

**Structural redundancy discovered:**
- 5 workflows can independently add items to the project board: `squad-triage`, `squad-issue-assign`, `squad-project-sync`, `squad-heartbeat`, `squad-project-board-automate`. All idempotent, all burning minutes.
- 2 of those (triage + issue-assign) hardcode project `#3` instead of using `SQUAD_PROJECT_NUMBER` variable — config drift risk.
- `squad-review-gate` fires on `synchronize` (every push) even though gate result is deterministic until labels change.
- `squad-auto-merge` fires on both `labeled` and `workflow_run: [CI, Squad Review Gate]` completions — double-trigger pattern on the happy path.
- `squad-visible-trail` fires on every issue/PR label event with no early-exit guard for irrelevant labels.

**Ceremony math for a typical S-size fix:**
- DP write: ~30 min. DR (Leela + Zapp approval): ~30-60 min. Wait time between sessions: ~15-60 min.
- Total pre-code overhead: 1-2 hours for a ≤2h task. The ceremony exceeds the work.

**The Copilot-is-faster gap is structural, not accidental.** Squad adds governance coordination overhead proportional to team size. With one developer + one Copilot session, the coordination is self-referential — Ahmed is both product owner AND reviewer, so the multi-reviewer gates he's waiting on are sessions he has to spawn himself.

**Key pattern:** The most valuable Squad components for a solo-developer workflow are: CI, secret scan, review-gate (as merge guard), auto-merge, velocity reporting. The most cost-heavy relative to value: DP ceremony for S-size work, synchronous DR before coding, multi-reviewer PR gate for chore/bug-fix paths.

**Recommendations actioned in decisions inbox:** See `kif-devops-bottleneck-audit.md`.

### 2026-04-27 — Fast lane implementation

**Changes shipped:**

1. **ceremonies.md** — Added "Minimum Ceremony Path" reference table after ceremony overview. Added Fast Lane exemption (`estimate:S` or `squad:chore-auto`) to both DP and DR sections. Added Parallel DR mode for `estimate:M`: post DP, start coding, DR reviewers run concurrently; blockers resolved before PR opens. No hard time window — with Ralph running continuously, reviewers respond in minutes.

2. **squad-review-gate.yml** — Removed `synchronize` from `on.pull_request.types`. Gate is label-driven and deterministic; firing on every push was ~50 wasted runs/week.

3. **squad-triage.yml** + **squad-issue-assign.yml** — Removed "Add issue to project board" steps from both. Both hardcoded `projectNumber = 3` (config drift risk). `squad-project-board-automate.yml` is the authoritative handler.

4. **squad-heartbeat.yml** — Removed "Add triaged issues to project board" step. Ralph adds `squad:*` labels, which trigger `squad-project-board-automate.yml` on the label event — the heartbeat step was a duplicate add. Note: heartbeat has SYNC comment pointing at 3 template files; templates NOT touched — `squad upgrade` required to propagate.

5. **squad-visible-trail.yml** — Added label/branch guards to `issue-trail` and `pr-trail` job `if:` conditions. Skips runs where no `squad:*` label or `squad/` branch is present (~60-70% of event volume).

**Issues found but not fixed:**
- `squad-heartbeat.yml` template sync: 3 additional template file locations exist per the SYNC comment. Only `.github/workflows/squad-heartbeat.yml` was modified. Template propagation deferred to `squad upgrade`.
- `squad-auto-merge.yml` double-trigger (labeled + workflow_run): not in scope for this change set; tracked in prior bottleneck audit.
