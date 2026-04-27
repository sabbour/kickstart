# Ceremonies

<!--
END-TO-END PROCESS FLOW:

Issue → Lead triages → Design Proposal (Lead facilitates) →
Design Review (Lead + Zapp + Nibbler + Amy approve) →
Implementation (Bender/Fry/Hermes) → PR →
PR Review Gate (Zapp security + Nibbler code quality + Lead architecture + Amy docs) →
CI green → Merge →
Release (Kif manages process, Amy writes release notes)
-->

Ceremonies are structured team interactions that the Squad coordinator triggers automatically before or after work. They are distinct from **automated workflows** (GitHub Actions), which run independently on schedule or events.

## Ceremony overview

| Ceremony | Trigger | When | Facilitator | Participants | Gate? |
|----------|---------|------|-------------|--------------|-------|
| Design Proposal | auto | before work | Leela | assigned agent, Amy (docs impact) | ✅ Blocks implementation until DP posted |
| Design Review | auto | before code | Leela | Zapp (security), Nibbler (code quality), Amy (docs impact), all-relevant | ✅ Blocks code until approved |
| PR Review Gate | auto | before merge | Nibbler | Nibbler (code), Zapp (security), Amy (docs — Phase 1), Leela (architecture — conditional) | ✅ Blocks merge until all feedback addressed |
| Retrospective | auto | after failure | Leela | Nibbler, Kif (if CI/workflow failure), all-involved | ❌ Diagnostic, not blocking |

## Minimum Ceremony Path

Quick-reference for ceremony requirements by size/type. Apply the first matching row.

| Size / Type | DP required? | DR required? | DR mode | Notes |
|---|---|---|---|---|
| `estimate:S` | ❌ No | ❌ No | — | Fast lane: straight to code |
| `chore-auto` | ❌ No | ❌ No | — | Fast lane: straight to code |
| `estimate:M` | ✅ Yes | ✅ Yes | Parallel | Post DP + start coding; DR runs concurrently; blockers resolved before PR opens |
| `estimate:L` | ✅ Yes | ✅ Yes | Sync | Wait for all approvals before coding |
| `estimate:XL` | ✅ Yes | ✅ Yes | Sync | Wait for all approvals before coding |

## Sizing Guide — Leela's triage decision criteria

Use this table to pick the right `estimate:*` label during triage. Apply the **first** row whose description fits.

| Label | Time | Points | Fits in 6h sprint? | Apply when… |
|---|---|---|---|---|
| `estimate:S` | ~15 min | 1 | ✅ Yes | Single-file change, no design decisions — typo fix, rename, small config tweak, boilerplate add. No DP or DR needed; fast lane applies. If implementation turns out larger, bump to M and write a DP. |
| `estimate:M` | ~1 hour | 3 | ✅ Yes | Multi-file change **or** a single file requiring a design choice. Needs a DP; DR runs in parallel. Clear scope — no unknowns that could cause it to balloon. |
| `estimate:L` | ~3 hours | 8 | ⚠️ At most one | Touches 3+ files **or** introduces a new pattern/abstraction. Needs full DP + synchronous DR. Can be broken into S/M sub-issues, but the issue stays L if they are tightly coupled. |
| `estimate:XL` | >3 hours | 20 | ❌ No | Feature or refactor spanning multiple components. **Must be split during triage** — Leela decomposes into child issues before assigning. Never enters a sprint whole. |

**Escalation rule:** When in doubt between two sizes, pick the smaller one and leave a one-line note on the issue. The PR Review Gate catches anything that turned out to be larger.

---

## Automated workflows (not coordinator ceremonies)

These run via GitHub Actions on schedule or events. Documented here for reference but **not checked by the coordinator** in `before`/`after` ceremony logic.

| Workflow | When | File | Persona | Artifact |
|----------|------|------|---------|----------|
| Per-PR Micro-Retro | PR closed | `.github/workflows/squad-pr-retro.yml` | Scribe | `.squad/retro-log.md` + PR comment |
| Daily Pulse | cron `0 0 * * *` (17:00 PT) | `.github/workflows/squad-daily-pulse.yml` | Scribe | rolling issue `📊 Daily Pulse (rolling)` |
| Weekly Pulse | cron `0 0 * * 2` (Mon 17:00 PT) | `.github/workflows/squad-weekly-pulse.yml` | Scribe | new issue `Weekly Pulse · YYYY-MM-DD` |
| Release Cadence | cron `0 0 * * *` (17:00 PT) | `.github/workflows/squad-release-cadence.yml` | Leela + Scribe | draft PR on `release/cadence` branch |
| Process Grader | cron `0 8 * * *` (08:00 UTC) | `.github/workflows/squad-process-grader.yml` | Scribe | grade comment + outcome label on due `process` issues, Scribe inbox entry |
| Project Board Automation | PR/issue label/state changes | `.github/workflows/squad-project-board-automate.yml` | Bender | automatic column moves on project board |

All crons are UTC. `0 0 * * *` = 17:00 PDT / 16:00 PST.

---

## Design Proposal

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before |
| **Condition** | any issue assigned to an agent for implementation work |
| **Facilitator** | Leela |
| **Participants** | assigned agent, Amy (docs impact assessment) |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

### Fast Lane exemption

If the issue is labeled `estimate:S` **or** `squad:chore-auto`, skip the DP entirely. The implementing agent proceeds directly to code. No DP comment is required, and the Design Review ceremony is also skipped (see [Design Review](#design-review) below).

> **Rationale:** For S-size work (≤2h implementation), the ceremony overhead (write DP, wait for DR approval) exceeds the implementation time. Fast lane eliminates this inversion.

**Gate:** No implementation code may be written until the DP is posted as a comment on the issue **unless the Fast Lane exemption applies**.

**DP structure** (the implementing agent posts a comment with):
- Problem statement (cite the issue body)
- Proposed approach with a reference to the relevant brief section
- Pack boundaries affected
- Primitive surface changes: tools, user actions, components, guardrails
- Security considerations: schema changes, trust boundaries, secrets
- Test strategy
- Docs and changeset plan: **Required.** List specific docs that need creating or updating (README sections, ADRs, identity guides, Docusaurus pages). Amy uses this as her task list during the PR Review Gate to commit docs directly to the PR branch. If no docs are needed, state "No docs impact" with justification.
- Alternatives considered

**Rules:**
- The issue body (problem + acceptance criteria) is written by the product owner or Lead. The DP (approach) is written by the implementing agent.
- Each PR maps to one issue. Split bundles.

**Agenda:**
1. Assigned agent drafts a Design Proposal comment on the issue
2. Leela reviews for completeness — does it cover architecture alignment with `docs/v2-implementation-brief.md`?
3. If incomplete, Leela requests revisions before proceeding to Design Review
4. DP comment posted → triggers Design Review ceremony

---

## Design Review

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before |
| **Condition** | DP comment posted on an issue, OR multi-agent task involving 2+ agents modifying shared systems |
| **Facilitator** | Leela |
| **Participants** | all-relevant, Zapp (security), Nibbler (code quality), Amy (docs impact) |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Gate:** No implementation code may be written until all reviewers approve the DP — **unless the Fast Lane or Async DR exemption applies (see below)**.

### Fast Lane exemption

If the issue is labeled `estimate:S` **or** `squad:chore-auto`, skip the DR entirely. The implementing agent proceeds directly to code.

### Parallel DR for `estimate:M`

If the issue is labeled `estimate:M`:
1. The implementing agent posts the DP comment on the issue.
2. DR reviewers (Zapp, Nibbler, Leela) are invoked **in parallel** with the start of implementation — no waiting period.
3. If a reviewer raises a blocking concern **before the first PR commit**, implementation pauses to address it.
4. If no blocking concern is raised by the time implementation is ready to open a PR, the agent proceeds.

> With Ralph running continuously, DR reviewers respond in minutes. The parallel model captures the same protection as synchronous DR without the pre-code idle wait.

### Synchronous DR (default for `estimate:L` and `estimate:XL`)

**Agenda:**
1. Review the DP comment on the issue
2. Leela evaluates architecture alignment and pack boundaries
3. Zapp evaluates security surface (tool schemas, guardrails, trust boundaries)
4. Nibbler evaluates code quality implications (patterns, test coverage expectations, complexity)
5. Amy evaluates the docs plan: are the listed docs tasks complete and correct? If the DP says "no docs impact" but Amy disagrees, she flags it. Amy's approved docs plan becomes her commit checklist during PR review.
6. Identify risks and edge cases
7. All reviewers approve → implementation proceeds
8. Decisions captured as comments on the issue

---

## PR Review Gate

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before merge |
| **Condition** | PR opened by a squad agent |
| **Facilitator** | Nibbler |
| **Participants** | Nibbler (code quality), Zapp (security), Amy (docs — Phase 1), Leela (architecture — conditional) |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Gate:** PR may NOT be merged until all review threads are resolved and all review gates are clear.

**Two-phase structure:**

**Phase 1 — Docs pass (runs in parallel with CI):**
- Amy reviews the PR and commits any missing or updated docs directly to the PR branch (commit as `sabbour-squad-docs[bot]`). PRs ship with complete docs — no follow-up tasks after merge.
- Amy then applies `docs:approved`, `docs:not-applicable`, or `skip-docs` (all three are accepted by the docs gate).
- Phase 1 MUST be complete — Amy's commit landed (if any) and the label applied — before Phase 2 begins.
- No approval reviews from Nibbler, Zapp, or Leela during Phase 1.

**Phase 2 — Approval reviews (after Phase 1 is complete):**
1. **Nibbler** — code correctness, readability, bug patterns, error handling, naming
2. **Zapp** — security surface, input validation, trust boundaries, secret handling
3. **Leela** — architecture alignment, pack boundaries, API contract consistency. **Conditional:** required only when the PR has an `architecture` label OR touches pack boundaries, new packs, API surface, or system design. NOT required for bug fixes, feature additions within existing packs, or docs-only changes.

**Hard rules:**
- **No commits after approvals:** Once Phase 2 begins (any approval review submitted), no further commits to the PR branch are permitted. If a commit is needed after approvals, the review cycle restarts from Phase 1.
- **Duplicate-review guard:** Before submitting a review, check whether you already have a review submitted for the current HEAD commit (`gh pr reviews {N}`). If yes, do not submit another. This prevents duplicate reviews from coordinator retry spawns.

**Feedback labels:**
- `nibbler:approved` / `nibbler:rejected` — code quality gate
- `leela:approved` / `leela:rejected` — architecture gate
- `zapp:approved` / `zapp:rejected` — security gate
- `docs:approved` / `docs:not-applicable` / `skip-docs` — documentation gate (Amy applies after review + any needed docs commits)

> **Mutual exclusivity:** For each reviewer namespace, `:approved` and `:rejected` are mutually exclusive. Adding one automatically removes the other — enforced by `squad-auto-merge.yml` on every `labeled` event. A PR will never carry both `nibbler:approved` and `nibbler:rejected` simultaneously.

**Merge criteria:** `nibbler:approved` + `zapp:approved` + (`docs:approved` OR `docs:not-applicable`) + CI green. `leela:approved` is additionally required when the PR has an `architecture` label or touches pack boundaries. Any rejection blocks merge and triggers revision by a different agent (per Reviewer Rejection Protocol).

**Auto-merge (default):** When a PR is opened, the coordinator or implementing agent enables auto-merge immediately: `gh pr merge {N} --auto --squash`. The PR merges automatically once all required status checks pass and all review gates clear. No manual merge click needed — the review gate IS the quality control.

> **Branch must be up to date (`strict_required_status_checks_policy: true`):** The `ci-gate` ruleset requires every branch to be up to date with `dev` before merging. A PR with all checks green but state `BEHIND` will stay stuck — auto-merge will not fire. Whenever a PR merges into `dev`, all remaining open PRs become `BEHIND` and need a branch update. Use `gh api --method PUT repos/azure-management-and-platforms/kickstart/pulls/<N>/update-branch` for each. Since PR #156, `squad-review-gate.yml` triggers on `pull_request.synchronize`, so the gate re-evaluates automatically on the new commit — label cycling is no longer required after `update-branch` (it remains a manual fallback if the workflow doesn't fire). See the **Keeping the Branch Current** section in `.squad/skills/pr-workflow/SKILL.md` for the full procedure.

**Feedback reply protocol (required for all reviewers and authors):**

All review feedback must be acknowledged before a thread may be resolved. Review sources all carry equal weight — none can be skipped:
- Squad bot reviewers: Leela, Zapp, Nibbler, Amy
- **GitHub Copilot PR review bot (`copilot-pull-request-reviewer[bot]`)**
- Human reviewers
- CI/CD status checks (failures are implicit feedback — fix before merge)

**Strict order for every thread — no exceptions:**
1. **Read and consider** the feedback
2. **Act or dismiss** — pick exactly one:
   - **Act:** Make the code/docs change, commit
   - **Dismiss:** Decide the feedback is incorrect or not applicable
3. **Post a reply** (this step is mandatory and comes BEFORE resolving):
   - After acting: `"Addressed in {sha}: {description of what changed and why}"`
   - After dismissing: `"Dismissed: {clear justification — why this is intentional or a false positive}"`
4. **Resolve the thread** via `resolveReviewThread` GraphQL mutation — only AFTER the reply is posted

**❌ FORBIDDEN — resolving without a reply.** Closing a thread silently — even after fixing the underlying code — is a protocol violation. The reply is the proof that the feedback was considered. Fix + reply + resolve is the indivisible unit. Any agent that resolves a thread without a reply must re-open it and add the reply.

**Iteration loop (hard gate):**
- After addressing a batch of feedback, re-check: are there still unresolved threads?
- If yes → repeat from step 1. The author keeps iterating until **0 unresolved threads remain**.
- If a reviewer re-requests changes after fixes, the cycle restarts — new feedback must be triaged the same way.
- The merge gate does NOT open until all threads from ALL sources are resolved.

This protocol applies to all agents (squad members AND @copilot). It is enforced by the coordinator and documented in `.github/copilot-instructions.md` for @copilot compliance.

---

## Retrospective

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | after |
| **Condition** | build failure, test failure, reviewer rejection, or any quality SLO in `.squad/velocity.md` turning 🔴 |
| **Facilitator** | Leela |
| **Participants** | all-involved, Nibbler (code quality analysis), Kif (if CI/workflow failure) |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. What happened? (facts only)
2. If an SLO tripped, inspect the latest `.squad/velocity.md` snapshot, name the breached metric, and compare it with the prior 4-week trend plus the relevant retro-log / pulse evidence
3. Root cause analysis
4. What should change? (concrete, testable)
5. Open a `process` issue for each action item → daily pulse tracks them

---

## Process Grader

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | scheduled (independent of coordinator ceremonies) |
| **Schedule** | cron `0 8 * * *` (daily 08:00 UTC) + `workflow_dispatch` |
| **Workflow** | `.github/workflows/squad-process-grader.yml` |
| **Facilitator** | Scribe |
| **Participants** | none (automation); evidence drawn from `.squad/velocity.md` |
| **Enabled** | ✅ yes |

**Purpose:** close the loop on `process` experiments created by the [Retrospective](#retrospective) ceremony. Each `process` issue carries a hypothesis frontmatter (`Signal`, `Baseline`, `Target`, `Revisit`). Once the `Revisit:` date is reached, the grader compares the latest `.squad/velocity.md` snapshot against the hypothesis and assigns a verdict.

**Outcomes (exactly one label applied per grading):**
- `process:succeeded` — signal hit the target (and moved beyond the noise band in the improving direction).
- `process:no-effect` — signal stayed within the noise band, or sample size was too small to conclude.
- `process:reverted` — signal moved in the wrong direction beyond the noise band, i.e. the experiment made things worse.

Any prior outcome label on the issue is cleared before the new one is applied so the three outcomes remain mutually exclusive.

**Revisit window:**
- On `process:succeeded` or `process:reverted` → terminal. The issue keeps its outcome label; no re-grading unless a human re-opens the experiment by resetting `Revisit:` and clearing the outcome label.
- On `process:no-effect` → the grader extends `Revisit:` by 14 days in-place (editing the issue body) up to a maximum of 2 extensions, giving the experiment time to accumulate more PRs. After the 2nd extension the next `no-effect` verdict is terminal.

**Rate-limit safeguards:**
- **Pre-flight abort:** if the REST API `core.remaining` budget is `< 200` at the start of the run, the grader logs a warning and exits without grading anything. This leaves headroom for interactive squad work the same morning.
- **Per-run cap:** at most **25 issues** are graded per run (`MAX_ISSUES_PER_RUN = 25`). Candidates are ordered oldest-`Revisit:` first; any overflow is deferred to the next scheduled run and logged via `core.notice`.
- **Concurrency guard:** workflow uses `concurrency: squad-process-grader` with `cancel-in-progress: false` so overlapping manual dispatches serialize rather than double-grade.

**Artifacts per graded issue:**
1. A grade comment on the issue summarising signal / baseline / target / observed / verdict.
2. The corresponding `process:{outcome}` label.
3. A Scribe inbox entry under `.squad/decisions/inbox/process-grader-{issue}-{date}.md` so the next decisions-merge run folds the result into `.squad/decisions.md`.
4. On `no-effect` extensions, an edited issue body with the new `Revisit:` date.

---

## Project Board Label-Driven Automation

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | during PR/issue lifecycle (label changes, PR open, PR merge) |
| **Workflow** | `.github/workflows/squad-project-board-automate.yml` |
| **Facilitator** | Bender (Backend infrastructure) |
| **Participants** | PR authors, reviewers |
| **Enabled** | ✅ yes |

**Purpose:** Automatically move PRs and issues between project board columns based on workflow state and review labels, keeping the project board in sync with actual work progress without manual intervention.

**Column State Machine (6-stage workflow):**

```
Backlog → Assigned → In Progress → In Review → Approved → Merged
```

| Column | Trigger | Auto-Move? | Notes |
|--------|---------|-----------|-------|
| **Backlog** | Issue/PR created without squad labels | Auto | Default column for unqualified items; squad-tagged items start here |
| **In Progress** | Branch push to `squad/NNN-*` branch OR `squad:in-progress` label added | Auto | Indicates active development work |
| **In Review** | PR opened from `squad/NNN-*` branch | Auto | PR awaiting reviewer feedback |
| **Approved** | `nibbler:approved` + `zapp:approved` + (`docs:approved` OR `docs:not-applicable`) | Auto | All required approvals collected; ready to merge |
| **Merged** | PR merged to `main` | Auto | Terminal state; work complete |

**Label-to-Column Mappings (Reference):**

| Condition | Moves To | Notes |
|-----------|----------|-------|
| `nibbler:approved` + `zapp:approved` + docs marker | "Approved" | All required review gates passed; `leela:approved` additionally required for PRs with `architecture` label |
| `docs:approved` OR `docs:not-applicable` OR `skip-docs` | Counts toward "Approved" | Either explicit docs review approval (Amy committed docs), not-applicable, or explicitly skipped |
| PR opened from `squad/NNN-*` branch | "In Review" | Automatically applied when PR title/branch matches squad naming convention |
| Branch push to `squad/NNN-*` | "In Progress" | Triggered by `pull_request.synchronize` event |
| PR merged to main | "Merged" | Terminal state; non-blocking (items remain in "Merged" for auditing) |

**Automation Rules:**

1. **Soft moves only:** The workflow checks the current column before moving. If an item is manually positioned in a later column (e.g., a PR manually moved from "In Review" to "Approved" to force merge), the automation respects that override and does not move it backwards.

2. **Label presence required:** Items automatically transition columns *only* when labels/events explicitly match. Removals of labels (e.g., `-nibbler:approved`) do not trigger backwards transitions; manual re-positioning is required. **Known interaction with mutual exclusivity:** when a required reviewer's `:rejected` label is applied, mutual exclusivity silently removes their `:approved` label — but because label removals don't trigger backwards moves, the board card will remain visually in "Approved" until the next label addition or a manual drag. If a PR appears stuck in "Approved" after a rejection, drag it back to "In Review".

3. **Non-blocking:** Project board state does not affect CI/CD gates. A PR in "Backlog" will still pass CI; the board is a visibility tool, not an enforcement mechanism.

4. **Idempotent:** Moving an item to the same column is a no-op (no API churn, no logging spam).

**Example Workflow:**

```
1. Issue #42 created with squad:bender label
   → Added to "Backlog" by squad-project-sync.yml

2. Bender opens PR #100 from squad/42-fix-auth branch
   → Automatically moved to "In Progress" by squad-project-board-automate.yml

3. Bender pushes changes to PR #100
   → Already in "In Progress"; no move (idempotent)

4. Amy reviews docs (Phase 1), commits any missing docs, applies docs:approved label
   → Phase 1 complete; Phase 2 begins

5. Nibbler + Zapp review (Phase 2), add nibbler:approved + zapp:approved labels
   → All gates met → automatically moved to "Approved"

6. PR merged to main
   → Automatically moved to "Merged" column

7. Project board shows full trail: Backlog → In Progress → In Review → Approved → Merged
```

**Configuration:**

The workflow requires `SQUAD_PROJECT_NUMBER` repo variable to be set to the GitHub Projects v2 number. If unset, the workflow logs an info message and exits gracefully (non-blocking).

If cross-repo or personal project access is needed, provide a PAT via the `COPILOT_ASSIGN_TOKEN` secret; otherwise the workflow uses `GITHUB_TOKEN`.

**Interaction with Ceremonies:**

- **Design Proposal / Design Review:** Not impacted; ceremonies happen before code is written, independent of project board state.
- **PR Review Gate:** Project board state is descriptive only; reviewers still apply approval labels (Leela, Nibbler, Zapp, Docs). The board reflects these decisions visually.
- **Retrospective:** If an SLO is tripped (e.g., "PRs in In Review > 3 days"), the retro can inspect project board history to identify bottlenecks.

---

## Persona mechanism

When a workflow opens an issue, PR, or comment via @copilot, it:

1. Adds a `squad:{member}` label.
2. Starts the body with `Working as {Name} ({Role}) — see .squad/agents/{name}/charter.md`.
3. If delegating a task to @copilot, names the persona explicitly (`@copilot — work as Scribe`).

The existing `.github/copilot-instructions.md` tells @copilot to load the referenced charter and work in that voice. No additional plumbing needed.
