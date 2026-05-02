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

### 2026-04-30 — Changeset package-name validation gap (PR #306)

`changeset status` failed in CI on PR #306 with `Found changeset 210-aks-recipes for package kickstart which is not in the workspace`. Root cause: two changesets (`210-aks-recipes.md`, `211-provenance-markers.md`) header-referenced `"kickstart"` — the root `package.json` `name`. Root package is `private: true` and not a workspace member, so changesets rejects it. There was a prior `fix-changeset-pkg` branch (`071f59a6`) that fixed only `210-aks-recipes` but never landed; `211-provenance-markers` carried the same bug.

**Fix pattern (now established):** When a changeset describes a repo-level config or doc change, attribute it to the package that consumes it, not the root:
- `config/aks-recipes.json` → `@aks-kickstart/pack-aks-automatic`
- `config/{tracks,inference-backends,component-catalog}.json` → `@aks-kickstart/pack-core` (consumers found via `grep packages/*/src`)

**Local validation command:** `npx --no-install changeset status` from repo root reproduces the CI failure exactly. Worth adding a cheap CI gate that runs this on PRs touching `.changeset/**` so the trap surfaces pre-merge instead of in the release/version pipeline.

**Process note:** The `npm run changeset` interactive prompt only lists workspace members, so this trap shows up only when changesets are hand-edited or generated by tooling that doesn't read `workspaces`. Decision recorded in `.squad/decisions/inbox/kif-changeset-status-package.md` (file is gitignored — Scribe folds it into `.squad/decisions.md`).

### 2026-05-01 — Review-gate bot login suffix drift (issue #315, PR #337)

**Symptom:** Docs PRs (#290, #300, #302, #303) sat with the docs role pending even after `squad-lead[bot]` posted APPROVE as the fallback approver. The gate's `requiredRoles` set never marked docs satisfied, so `squad/review-gate` stayed `failure` and auto-merge never triggered.

**Root cause:** GitHub returns App reviews with `r.user.login = "squad-lead[bot]"` in REST payloads. The deployed `.github/workflows/squad-review-gate.yml` compared `login.toLowerCase()` (kept the suffix) against `fallbackApprover.toLowerCase()` (also kept the suffix) — fine in isolation. The actual drift is on **other** code paths the issue references where the `[bot]` suffix is missing — and the inline filter had no shared normalization. A second source of literal failure: when the bot login map carries the canonical app slug (`squad-platform[bot]` for devops) but a reviewer authenticates via a slightly different installation surface, the suffix may not appear. Same pattern.

**Fix:** Added `normalizeBotLogin(login)` inside the gate script — lowercases and strips trailing `[bot]`. Applied on both sides of the primary, self-approval, and fallback comparisons. Source-of-truth scaffold (`.github/extensions/squad-reviews/lib/scaffold-gate.mjs`) already had this helper since a prior pass; the deployed workflow had drifted older. Manual edit in worktree avoided re-running `squad_reviews_scaffold_gate` (which writes against the main repo root and would have stomped unrelated user changes in the parent checkout).

**Trap discovered:** `squad_reviews_scaffold_gate` resolves REPO_ROOT from the extension's install path (always the main repo), not the calling worktree. Calling it while a worktree-scoped change is in flight will write into the wrong tree and may overwrite the main checkout's uncommitted experiments. **Always edit deployed workflow YAML in-place inside the worktree** for surgical fixes; only rerun the scaffold tool when intentionally regenerating from scratch in a clean main checkout. Worth noting in the kif charter / review-gate skill if we ever see this trap again.

**Validation:** YAML parses; pre-existing `@opentelemetry/api-logs` test failures are unrelated.

## 2026-05-01 — PR #337 scaffold drift follow-up (Nibbler block)

Nibbler's request-changes review noted that PR #337 only patched the deployed
`.github/workflows/squad-review-gate.yml` while the source generator
`.github/extensions/squad-reviews/lib/scaffold-gate.mjs` still emitted the
older shape. Although the scaffold already had `normalizeBotLogin` (added in
PR #316), it lacked the issue-#315 explanatory comment and inlined
`normalizeBotLogin(fallbackApprover)` instead of precomputing
`normalizedFallback`. Re-scaffolding would have stripped the deployed
refinements.

Fix (commit e8dd044b): updated `generateReusableWorkflow` in
`scaffold-gate.mjs` so the emitted script contains the comment block and
precomputed `normalizedFallback`. Verified `scaffoldGate(dryRun: true)`
output now matches the deployed workflow byte-for-byte except for the
intentional config-derived role / botLogin / gateRule payloads. Both YAMLs
parse cleanly via `yaml.safe_load`.

**Decision (team-relevant):** Whenever the deployed review-gate workflow
needs an inline-script change, update `scaffold-gate.mjs` in the same PR.
Validate with `node -e "import('./.../scaffold-gate.mjs').then(m => ...)"`
dry-run + diff against the deployed file before pushing — only
config-derived payloads are allowed to differ.
## Docs Restructure Audit (2026-05-01)
- Completed baseline inventory of docs-site/docs and ADR structure
- Risk check: recommended isolated worktree, explicit staging, redirects, local docs build/link checks
- Single-PR strategy approved to avoid pipeline inefficiency
- Follow-up: CI fast-path implementation for docs-only PRs (issue #????)

## Learnings

### 2026-05-01T12:41:57-07:00 — Review/CI gate cleanup
- **Pure base-sync detection**: `pull_request.synchronize` events fire on both content pushes and "Update branch" / merge-from-base operations. Distinguish them by comparing the file signature of `compare(base...before)` vs `compare(base...after)` via the GitHub Compare API. Identical signatures → PR-vs-base diff unchanged → preserve approvals. Implemented in `squad-review-gate.yml` and `squad-auto-merge.yml`.
- **Required reviewer roles** are now `codereview,security`. Docs role moved to `optional` in `.squad/reviews/config.json`. Amy still posts docs feedback as PR comments and the `docs:rejected` label remains a hard block in auto-merge for explicit rejections, but missing docs marker no longer blocks merge.
- **Markdown-only fast path**: a `changes` job in `ci.yml` uses `actions/github-script` to paginate PR files and emit `markdown_only` / `dockerfiles_changed` outputs. `lint-build` is skipped when `markdown_only=true`. `ci-gate` already accepts `skipped` as success → required `CI Gate` check stays green without running heavy steps.
- **Conditional hadolint install**: only installs when Dockerfiles change (or on push to main). Saves ~10s per docs/code PR with no Dockerfile changes.
- **GraphQL gotcha**: when adding `baseRefOid` to a PR query in `squad-auto-merge.yml`, also need it for synchronize-event base-sync detection — `context.payload.pull_request.base.sha` is not always available in `pull_request_target` payload structures used by github-script.

### 2026-05-01T12:41:57-07:00 — CI changes-job hardening (follow-up)
- **Skipped-dependency cascade trap**: a job with `needs: [X]` is skipped when `X` is skipped, *even if* its own `if:` would otherwise let it run. Original `changes` job was gated `if: github.event_name == 'pull_request'`, which would have silently skipped `lint-build` on push-to-`main`.
- **Fix**: `changes` now always runs and short-circuits to `docs_only=false`, `dockerfiles_changed=true` for non-PR events. Heavy jobs key off `docs_only != 'true'`.
- **Renamed output** `markdown_only` → `docs_only` because the classifier already accepts `docs/`, `docs-site/`, `.squad/`, `.changeset/` (not just `*.md`).
- **CI Gate hardening**: now `needs: [changes, lint-build, e2e]` and explicitly fails when `changes.result != 'success'`. Prevents a `changes` failure from cascading skips into a falsely green required check.

## Spawn: ralph-wave-2 (2026-05-01T12:13:25)
- **PR #337**: scaffold source drift fixed → **codereview approved** ✅

### 2026-05-01T13:27:17-07:00 — Corrected docs/security gate policy (DP kif-docs-pr-fastpath, final)
- **Two-step user correction**: (1) prior pass over-rotated to "docs optional"; (2) intermediate fix over-required docs signal on docs-only PRs. Final landing: docs is required *because of* code changes, not for its own sake — docs-only PRs skip docs/security/architecture entirely.
- **Docs-only definition**: every changed path matches `(*.mdx?|^docs/|^docs-site/|^.squad/|^.changeset/)`, no path matches the sensitive set (`^.github/workflows/`, `auth|guardrail|security` namespace), and no `architecture` label. Codereview is still required.
- **`docs:rejected` is always a hard block**, including on docs-only PRs — that check runs before the docs-only short-circuit in `getDocsSignalBlocker`.
- **Self-approval deadlock**: solved structurally by removing the requirement entirely on docs-only PRs, not by a fallback approver.
- **Three workflows updated in lockstep** to keep policy consistent: review-gate decides which roles must approve; auto-merge decides which approval labels block merge; project-board decides which label set moves a PR to "Approved". Drifting any one silently breaks the gate.
- **Docs signal still required for code PRs**: enforced in auto-merge `getDocsSignalBlocker` via label (`docs:approved` / `docs:not-applicable`) OR content-based satisfaction (PR ships `docs/`, `docs-site/`, `.changeset/`, `*.md(x)`).
- **Project-board Approved column** does a paginated `pulls.listFiles` API call only when the PR otherwise looks ready (codereview:approved present but standard-path criteria not met) — keeps API-call rate negligible.
- **Validation**: js-yaml + JSON parse ✅; embedded github-script bodies parse as `(async()=>{…})()` after substituting `${{ }}` ✅; `git diff --check` clean ✅.

### 2026-05-01T13:35:08-07:00 — Removed `skip-docs` from docs policy (DP kif-remove-skip-docs)
- **What**: dropped `skip-docs` as an accepted docs bypass. Code-PR docs signal is now satisfied only by `docs:approved`, `docs:not-applicable`, or content (docs-site / changeset / `*.md(x)` shipped in the PR). Docs-only PRs continue to skip the docs gate entirely.
- **Files updated**: `ci.yml` (changeset waiver now keys off `docs:not-applicable`/`docs:approved`), `squad-review-gate.yml` (comment only — `bypassLabels` is config-driven), `squad-auto-merge.yml` (removed `SKIP_DOCS_LABEL` constant + check + docstring + audit-message refs), `squad-project-board-automate.yml` (removed `skip-docs` from label-event short-circuit), `sync-squad-custom-labels.yml` (removed label definition; left a tombstone comment so the historical context is discoverable), `.squad/reviews/config.json` (`bypassLabels` no longer lists `skip-docs`).
- **Existing `skip-docs` labels in the repo** are intentionally NOT deleted by automation — that's a label-deletion policy decision for Amy/Hermes. The label simply no longer satisfies any gate; PRs still carrying it must adopt `docs:not-applicable` to merge.
- **Validation**: js-yaml + JSON parse ✅; embedded github-script bodies still parse ✅; `git diff --check` clean ✅. Remaining `skip-docs` matches in workflow/config files are tombstone comments explaining the removal — verified with `grep -n "skip-docs"`.
- **Repo-wide grep coordination**: prose still mentioning `skip-docs` lives in `.squad/ceremonies.md`, `.squad/agents/nibbler/charter.md`, and `.squad/skills/squad-reviews/SKILL.md`. These are owned by Amy/Leela/Nibbler/Hermes (per charter boundary — DevOps doesn't rewrite user-facing docs prose). Flagged in `.squad/decisions/inbox/kif-remove-skip-docs.md` for their next pass. Workflows + config are the source of truth.
- **Generator parity**: also updated `.github/extensions/squad-reviews/lib/scaffold-gate.mjs` so future regenerated review-gate workflows don't reintroduce the `skip-docs` example comment.

### 2026-05-01T13:46:56.014-07:00 — Upstreamed corrected docs/review/CI gate policy
- Applied the downstream docs-gate correction back to `squad-reviews` and `squad-workflows`: `skip-docs` is no longer active behavior, docs-only PRs avoid docs/security/architecture gates unless sensitive/architecture triggers apply, code PRs need `docs:approved` or `docs:not-applicable`, and `docs:rejected` hard-blocks.
- Upstream generators/templates now preserve approval labels on pure base-sync updates and keep docs-only CI fast paths green through an explicit `CI Gate` aggregator while preserving full CI on non-PR runs.
- Validation: `npm test`, `git diff --check`, module syntax checks, generated github-script parse, and CI workflow YAML parsing passed in both upstream repos.

### 2026-05-01T13:46:56.014-07:00 — Synced upstream generated squad-workflows gate layer
- Hermes was right to check both source and installed extension copies: `squad-workflows` had corrected docs/review policy in source/templates, but the active tracked `.github/extensions/squad-workflows/lib/` copy still carried stale merge-check/config/setup behavior.
- Fixed the generated/installed layer by syncing the corrected source extension files for merge checks, workflow config defaults, label setup, init label creation, and doctor label validation.
- Validation in `squad-workflows`: `npm test` 18/18 ✅; changed extension modules `node --check` ✅; `.github/workflows/squad-ci.yml` and `.squad/templates/workflows/squad-ci.yml` YAML parse ✅; `git diff --check` ✅; active `skip-docs|SKIP_DOCS|skipDocs` grep ✅ no hits.

### 2026-05-01T13:46:56.014-07:00 — Active synchronize approval clearing
- **Lesson**: preserving approvals on base-sync by omission is not sufficient; `pull_request.synchronize` needs explicit stale-label clearing for real content pushes and an explicit pure base-sync fast path.
- **Heuristic**: treat a synchronize event as pure base-sync when the new head commit is a merge commit whose first parent is the event `before` SHA and whose parents include the PR base SHA; otherwise clear approval labels and `docs:not-applicable`, but keep `docs:rejected` as the hard-block signal.

### 2026-05-01T13:46:56.014-07:00 — Scoped synchronize approval invalidation
- **Refinement**: do not blanket-clear approvals on every real synchronize. Reapproval should be scoped to domains impacted by the changed files and policy labels.
- **Classifier**: base-sync preserves all labels; security-like changes clear only security, architecture boundary/config/API changes clear only architecture, docs-like changes clear docs signals, and general product code clears codereview/docs. `docs:rejected` remains a hard blocker and is not auto-cleared.

### 2026-05-01T14:13:44.386-07:00 — Role-scoped reapproval implemented locally and upstream
- Changed active Kickstart workflows plus the installed/upstream `squad-reviews` scaffold sources so base-sync preserves every approval, while real synchronize events clear only labels whose reviewer-domain triggers match the changed paths.
- Added explicit architecture invalidation paths for package/API/schema/contract/pack-boundary surfaces; security/docs/codereview invalidation now follows their gate rules instead of blanket-clearing all roles.
- Preserved the corrected docs policy: docs-only PRs need no docs gate, code-bearing PRs need docs signal, and `docs:rejected` remains a hard block that automation never clears.

### 2026-05-01T13:46:56.014-07:00 — Workflow-backed role-scoped invalidation
- **Correction**: policy capture is not enough; the active `squad-workflows` CI workflow and template now execute role-scoped invalidation directly.
- **Validation added**: tests exercise pure base-sync preservation, security-only invalidation, architecture-only invalidation, multi-domain scoped invalidation, and the existing docs approval/not-applicable docs-only gate behavior.

### 2026-05-01T13:46:56.014-07:00 — Batched feedback response policy
- **Noise reduction**: feedback loops now instruct agents to handle all related unresolved PR review threads in one implementation pass, one validation run, one feedback-fix commit, and one consolidated PR update where possible.
- **Why**: avoiding one commit/comment per thread reduces notifications and prevents repeated synchronize-triggered approval invalidation or branch rebase churn.
- **Scope**: local installed squad-workflows/squad-reviews extension layers and Ralph/pr-feedback guidance were updated alongside upstream `squad-workflows` and `squad-reviews`.

### 2026-05-01T14:13:44.386-07:00 — Batched review-feedback loop
- Added a consolidated feedback-batch comment surface to `squad-reviews` and synced the installed local extension so agents can post/update one PR-level summary after one feedback-fix commit.
- Updated local/upstream guidance to require one implementation pass, one validation run, and one commit per related PR feedback batch where possible, while still replying to each thread before resolving it.
- This complements role-scoped reapproval: fewer synchronize events means fewer approval invalidations/rebases, and when invalidation happens it remains scoped to affected domains.

### 2026-05-01T14:39:15.602-07:00 — Push/release staging plan prepared
- Audited dirty state in `kickstart`, `squad-reviews`, and `squad-workflows` after Hermes PASS without committing, pushing, tagging, versioning, or releasing.
- Staging recommendation: keep validated gate-policy, scoped approval invalidation, feedback batching, and docs-signal files; exclude runtime/session artifacts (`prs.json`, `.squad/attestation/`, `.squad/reviews/audit.jsonl`, circuit-breaker state, generated history summaries).
- Upstream release recommendation: `@sabbour/squad-reviews` minor bump `1.3.3` → `1.4.0`; `@sabbour/squad-workflows` minor bump `1.2.3` → `1.3.0`, with a blocker to reconcile missing tags/changelog entries after `v1.2.0`.

### 2026-05-01T14:39:15-07:00 — Release push for review gate refinements
- Prepared upstream Changesets releases for `squad-reviews` v1.4.0 and `squad-workflows` v1.3.0 from validated gate/feedback changes.
- Pushed upstream `main` branches and tags `v1.4.0` / `v1.3.0`; npm publishing remains pending because npm registry auth is unavailable in this environment.
- Validated Kickstart with `npm test` and `npm run build` before committing local gate/review feedback updates. Direct `dev` push was blocked by repository rules, so the commit was pushed to `squad/kif-review-gates-release` and PR #344 was opened for PR-based integration.

### 2026-05-01T15:58:39-07:00 — Two-step PR closure update for #344
- Updated PR #344 branch with the locally validated two-step closure rule: after all review threads resolve, agents must check `reviewDecision`, ping human reviewers when it remains `CHANGES_REQUESTED`, and submit Squad role-gate approval separately.
- Kept the push scoped to active Kickstart installed extension/guidance changes and excluded runtime artifacts such as `prs.json`, attestation state, audit logs, and circuit-breaker state.
