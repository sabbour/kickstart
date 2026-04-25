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
| PR Review Gate | auto | before merge | Nibbler | Leela (architecture), Zapp (security), Amy (docs), Hermes (tests) | ✅ Blocks merge until all feedback addressed |
| Retrospective | auto | after failure | Leela | Nibbler, Kif (if CI/workflow failure), all-involved | ❌ Diagnostic, not blocking |

## Automated workflows (not coordinator ceremonies)

These run via GitHub Actions on schedule or events. Documented here for reference but **not checked by the coordinator** in `before`/`after` ceremony logic.

| Workflow | When | File | Persona | Artifact |
|----------|------|------|---------|----------|
| Per-PR Micro-Retro | PR closed | `.github/workflows/squad-pr-retro.yml` | Scribe | `.squad/retro-log.md` + PR comment |
| Daily Pulse | cron `0 0 * * *` (17:00 PT) | `.github/workflows/squad-daily-pulse.yml` | Scribe | rolling issue `📊 Daily Pulse (rolling)` |
| Weekly Pulse | cron `0 0 * * 2` (Mon 17:00 PT) | `.github/workflows/squad-weekly-pulse.yml` | Scribe | new issue `Weekly Pulse · YYYY-MM-DD` |
| Release Cadence | cron `0 0 * * *` (17:00 PT) | `.github/workflows/squad-release-cadence.yml` | Leela + Scribe | draft PR on `release/cadence` branch |
| Process Grader | cron `0 8 * * *` (08:00 UTC) | `.github/workflows/squad-process-grader.yml` | Scribe | grade comment + outcome label on due `process` issues, Scribe inbox entry |

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

**Gate:** No implementation code may be written until the DP is posted as a comment on the issue.

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

**Gate:** No implementation code may be written until all reviewers approve the DP.

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
| **Participants** | Leela (architecture), Zapp (security), Amy (docs review), Hermes (test coverage) |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Gate:** PR may NOT be merged until all review threads are resolved and all reviewers have approved.

**Review dimensions:**
1. **Nibbler** — code correctness, readability, bug patterns, error handling, naming
2. **Leela** — architecture alignment, pack boundaries, API contract consistency
3. **Zapp** — security surface, input validation, trust boundaries, secret handling
4. **Hermes** — test coverage for new/changed code, edge cases, regression risk
5. **Amy** — documentation impact, changeset presence, docs accuracy. **Amy is an active contributor, not just a reviewer.** If docs are missing or need updating, Amy pushes the docs changes directly to the PR branch (commit as `sabbour-squad-docs[bot]`), then applies the docs label. PRs ship with complete docs — no follow-up tasks after merge.

**Feedback labels:**
- `nibbler:approved` / `nibbler:rejected` — code quality gate
- `leela:approved` / `leela:rejected` — architecture gate
- `zapp:approved` / `zapp:rejected` — security gate
- `docs:approved` / `docs:not-applicable` — documentation gate (Amy applies after review + any needed docs commits)

**Merge criteria:** All four approval labels present (`leela:approved` + `zapp:approved` + `nibbler:approved` + `docs:approved` or `docs:not-applicable`) + CI green. Any rejection blocks merge and triggers revision by a different agent (per Reviewer Rejection Protocol).

**Auto-merge (default):** When a PR is opened, the coordinator or implementing agent enables auto-merge immediately: `gh pr merge {N} --auto --squash`. The PR merges automatically once all required status checks pass and all review gates clear. No manual merge click needed — the review gate IS the quality control.

**Feedback reply protocol (required for all reviewers and authors):**

All review feedback — from squad reviewers (Leela, Zapp, Nibbler, Amy), the GitHub Copilot review agent, and human reviewers — must be triaged and resolved before merge. No comment is ignored.

**For each unresolved comment or review thread, the author MUST:**
1. **Read and consider** the feedback
2. **Act or dismiss:**
   - **Act:** Make the code/docs change, commit, then reply: `"Addressed in {sha}: {description}"`
   - **Dismiss with justification:** If the feedback is incorrect or not applicable, reply with a clear reason why: `"Dismissed: {justification}"` — e.g., "This is intentional because X" or "False positive — the pattern is safe here because Y"
3. **Resolve the thread** via GitHub GraphQL API (`resolveReviewThread` mutation) after replying
4. **Never silently skip** — every comment gets a reply, even if dismissed

**Iteration loop (hard gate):**
- After addressing a batch of feedback, re-check: are there still unresolved threads?
- If yes → repeat from step 1. The author keeps iterating until **0 unresolved threads remain**.
- If a reviewer re-requests changes after fixes, the cycle restarts — new feedback must be triaged the same way.
- The merge gate does NOT open until all threads from ALL sources are resolved.

**Feedback sources (all are equal — none can be skipped):**
- Squad bot reviewers (Leela, Zapp, Nibbler, Amy)
- GitHub Copilot review agent (automated AI review)
- Human reviewers
- CI/CD status checks (failures are implicit feedback — fix before merge)

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

## Persona mechanism

When a workflow opens an issue, PR, or comment via @copilot, it:

1. Adds a `squad:{member}` label.
2. Starts the body with `Working as {Name} ({Role}) — see .squad/agents/{name}/charter.md`.
3. If delegating a task to @copilot, names the persona explicitly (`@copilot — work as Scribe`).

The existing `.github/copilot-instructions.md` tells @copilot to load the referenced charter and work in that voice. No additional plumbing needed.
