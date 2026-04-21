# Ceremonies

Ceremonies are structured team interactions that the Squad coordinator triggers automatically before or after work. They are distinct from **automated workflows** (GitHub Actions), which run independently on schedule or events.

## Ceremony overview

| Ceremony | Trigger | When | Facilitator | Participants | Gate? |
|----------|---------|------|-------------|--------------|-------|
| Sprint Planning | auto | every 6h (00:00 / 06:00 / 12:00 / 18:00 UTC — Ahmed may override) | Leela | all active squad + Ahmed (PO) | ❌ Backlog shaping, not a hard gate |
| Design Proposal | auto | before work | Leela | assigned agent | ✅ Blocks implementation until DP posted |
| Design Review | auto | before code | Leela | Zapp, Nibbler, all-relevant | ✅ Blocks code until approved |
| PR Review Gate | auto | before merge | Nibbler | Leela (architecture), Zapp (security), Nibbler (code quality), Docs reviewer (Scribe interim — McManus not on roster) | ✅ Blocks merge until all four approval labels present + CI green |
| Docs Sweep | auto | monthly | Scribe | all-relevant | ❌ Freshness audit, not blocking |
| Cadence Retrospective | auto | end of each 6h sprint | Leela | all squad + Scribe | ❌ Continuous improvement, not blocking |
| Failure Retrospective | auto | after failure | Leela | Nibbler, all-involved | ❌ Diagnostic, not blocking |

## Automated workflows (not coordinator ceremonies)

These run via GitHub Actions on schedule or events. Documented here for reference but **not checked by the coordinator** in `before`/`after` ceremony logic.

| Workflow | When | File | Persona | Artifact |
|----------|------|------|---------|----------|
| Per-PR Micro-Retro | PR closed | `.github/workflows/squad-pr-retro.yml` | Scribe | `.squad/retro-log.md` + PR comment |
| Daily Pulse | cron `0 0 * * *` (17:00 PT) | `.github/workflows/squad-daily-pulse.yml` | Scribe | rolling issue `📊 Daily Pulse (rolling)` |
| Weekly Pulse | cron `0 0 * * 2` (Mon 17:00 PT) | `.github/workflows/squad-weekly-pulse.yml` | Scribe | new issue `Weekly Pulse · YYYY-MM-DD` |
| Weekly Velocity Report | cron `0 0 * * 1` (Sun 17:00 PT) | `.github/workflows/squad-velocity-report.yml` | Scribe | `.squad/velocity.md` |
| Monthly Docs Sweep | cron `0 0 2 * *` (~1st day 17:00 PT) | `.github/workflows/squad-monthly-docs-sweep.yml` | Scribe | rolling issue `📚 Docs Sweep (rolling)` |
| Release Cadence | cron `0 0 * * *` (17:00 PT) | `.github/workflows/squad-release-cadence.yml` | Leela + Scribe | draft PR on `release/cadence` branch |

All crons are UTC. `0 0 * * *` = 17:00 PDT / 16:00 PST.

---

## Sprint Planning

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | every 6 hours on a fixed UTC schedule — anchors at **00:00 / 06:00 / 12:00 / 18:00 UTC**. Ahmed (PO) may override the anchor times by amending this row; the coordinator uses whatever is written here. |
| **Condition** | start of a new 6h sprint window, or ≥5 open `squad` issues lack an `estimate:*` label |
| **Facilitator** | Leela |
| **Participants** | all active squad members + assigned human PO (Ahmed) |
| **Time budget** | focused — must fit inside the 6h window it is planning |
| **Enabled** | ✅ yes |
| **Gate?** | ❌ Not a hard gate — a missing estimate is caught downstream by the Design Proposal ceremony gate. |

**Goal:** Shape the next 6h sprint backlog so every in-flight issue has an estimate, an owner, and a sprint goal before implementation work starts — and so the total in-scope work fits in 6 hours.

**Agenda:**
1. Pull open issues carrying the `squad` label that are unestimated (no `estimate:*` label).
2. For each, assign one of `estimate:S` / `estimate:M` / `estimate:L` / `estimate:XL` per the velocity-points table in the Design Proposal ceremony below.
3. **XL-split rule:** any issue that lands at `estimate:XL` (>3h) **does not enter a sprint**. Leela splits it into `S`/`M`/`L` children during triage and only the children are eligible for planning. An XL issue on the board at sprint-planning time is a blocker for that planning session.
4. Confirm or assign the `squad:{member}` label so each issue has a clear owner.
5. Agree the sprint goal in one sentence.
6. Capture outcomes in a new sprint note at `.squad/sprints/{YYYY-MM-DDThh}Z.md` (timestamped to the 6h anchor, e.g. `2026-04-21T12Z.md` for the 12:00 UTC sprint) — sprint goal, in-scope issue list with estimates and owners, explicit deferrals, known risks.

**Output:** `.squad/sprints/{YYYY-MM-DDThh}Z.md`. The file is informational; the real gate remains the DP ceremony (which rejects any DP whose estimate is missing or mismatched).

---

## Design Proposal

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before |
| **Condition** | any issue assigned to an agent for implementation work |
| **Facilitator** | Leela |
| **Participants** | assigned agent |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Gate:** No implementation code may be written until the DP is posted as a comment on the issue.

**Estimate calibration:** every implementation issue carries exactly one estimate label and the DP must repeat that estimate in the proposal. Bands are sized for the **6h sprint cadence** — a single sprint should absorb one L, several M's, or a cluster of S's.

| Label | Time band | Velocity points | Fits in a 6h sprint? |
|-------|-----------|-----------------|----------------------|
| `estimate:S` | ~15 min | 1 | ✅ |
| `estimate:M` | ~1 hour | 3 | ✅ |
| `estimate:L` | ~3 hours | 8 | ✅ (at most one per sprint, leaves headroom) |
| `estimate:XL` | >3 hours | 20 | ❌ — **must be split** into `S`/`M`/`L` children before Sprint Planning accepts it |

**XL-split rule:** An `estimate:XL` label means "does not fit in a single 6h sprint." XL issues never enter sprint scope. Leela splits them during triage into smaller children that each carry their own `estimate:S/M/L` label. If a DP lands with `Estimate: XL`, Leela rejects the DP with a split plan instead.

**DP structure** (the implementing agent posts a comment with):
- Problem statement (cite the issue body)
- `Estimate: <S/M/L/XL>` (required; must match the issue's `estimate:*` label)
- Proposed approach with a reference to the relevant brief section
- Pack boundaries affected
- Primitive surface changes: tools, user actions, components, guardrails
- Security considerations: schema changes, trust boundaries, secrets
- Test strategy
- `Docs impact:` (**required**) — explicit list of affected doc pages/sections (e.g., `docs-site/docs/architecture/v2-implementation-brief.md`, a pack page, a charter, a skill file, `README.md`) **OR** an explicit `N/A` with one-sentence justification for why this change touches no user-facing behavior, APIs, pack surface, ceremonies, skills, or process. A missing or empty `Docs impact:` field is an automatic DP rejection.
- Docs and changeset plan (how the docs impact above will actually be landed — in this PR, or tracked as a follow-up with an issue link)
- Alternatives considered

**Rules:**
- The issue body (problem + acceptance criteria) is written by the product owner or Lead. The DP (approach) is written by the implementing agent.
- Each PR maps to one issue. Split bundles.
- Leela rejects a DP that is missing the `Estimate:` field or does not match the issue's `estimate:*` label.
- Leela rejects a DP that is missing the `Docs impact:` field, or whose `Docs impact: N/A` claim is not justified.

**Agenda:**
1. Assigned agent drafts a Design Proposal comment on the issue
2. Leela reviews for completeness — does it cover architecture alignment with `docs-site/docs/architecture/v2-implementation-brief.md`?
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
| **Participants** | all-relevant, Zapp for security, Nibbler for code quality |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Gate:** No implementation code may be written until all reviewers approve the DP.

**Agenda:**
1. Review the DP comment on the issue
2. Leela evaluates architecture alignment and pack boundaries
3. Zapp evaluates security surface (tool schemas, guardrails, trust boundaries)
4. Nibbler evaluates code quality implications (patterns, test coverage expectations, complexity)
5. Identify risks and edge cases
6. All three approve → implementation proceeds
7. Decisions captured as comments on the issue

---

## PR Review Gate

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before merge |
| **Condition** | PR opened by a squad agent |
| **Facilitator** | Nibbler |
| **Participants** | Leela (architecture), Zapp (security), Nibbler (code quality), Docs reviewer — **Scribe (interim)** |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Gate:** PR may NOT be merged until all review threads are resolved and all four structured reviewers have approved.

> **Docs reviewer role gap:** The Ahmed directive names McManus as the docs reviewer. McManus is not currently on the roster in `.squad/team.md`. Until a docs reviewer is cast, **Scribe** fills this role as interim docs reviewer and owns the `docs:*` labels. When McManus (or another docs reviewer) is added to the roster, update this section and the ceremony overview table to reassign the role.

**Review dimensions:**
1. **Nibbler** — code correctness, readability, bug patterns, error handling, naming. Posted via `gh pr review` under the `lead` bot identity (same protocol as Leela and Zapp).
2. **Leela** — architecture alignment, pack boundaries, API contract consistency. Posted via `gh pr review` under the `lead` bot identity.
3. **Zapp** — security surface, input validation, trust boundaries, secret handling. Posted via `gh pr review` under the `lead` bot identity.
4. **Docs reviewer (Scribe interim)** — verifies that every doc page/section listed in the DP's `Docs impact:` field is actually updated in this PR (or has an explicit, linked follow-up issue), that changesets are present where required, that no user-facing behavior ships without corresponding docs, and that a `Docs impact: N/A` claim genuinely holds. Posted via `gh pr review` under the appropriate bot identity.

Hermes remains the owner of test-coverage analysis and contributes findings into the Nibbler and Leela review passes; Hermes is not a separate approval gate on the PR.

**Feedback labels (all four are equal-weight approval gates):**
- `leela:approved` / `leela:rejected` — architecture gate
- `zapp:approved` / `zapp:rejected` — security gate
- `nibbler:approved` / `nibbler:rejected` — code quality gate
- `docs:approved` / `docs:rejected` / `docs:not-applicable` — docs gate. `docs:not-applicable` is a valid approval **only** when the DP's `Docs impact:` field was `N/A` with justification; it must be applied explicitly, never defaulted.

**Merge criteria:** All four approval labels present (`leela:approved` + `zapp:approved` + `nibbler:approved` + (`docs:approved` OR `docs:not-applicable`)) + CI green. Any rejection blocks merge and triggers revision by a different agent (per Reviewer Rejection Protocol).

**Feedback reply protocol (required for all reviewers and authors):**
1. When addressing any review comment, the author MUST reply to the specific comment with: "Addressed in {sha}: {description}"
2. After replying, resolve the thread via GitHub GraphQL API (`resolveReviewThread` mutation)
3. Verify 0 unresolved threads before attempting merge
4. Never silently fix and move on — a reply is required on every comment

This protocol applies to all agents (squad members AND @copilot). It is enforced by the coordinator and documented in `.github/copilot-instructions.md` for @copilot compliance.

---

## Cadence Retrospective

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | end of each 6h sprint (at the next 6h anchor — i.e. immediately before the next Sprint Planning) |
| **Condition** | a 6h sprint window just closed (distinct from the failure-triggered Failure Retrospective below) |
| **Facilitator** | Leela |
| **Participants** | all squad + Scribe |
| **Time budget** | focused — small; this runs four times a day and must stay lightweight |
| **Enabled** | ✅ yes |
| **Gate?** | ❌ Not a hard gate — continuous-improvement ceremony. |

**Goal:** Continuous improvement on a fixed 6h cadence, independent of whether anything failed this sprint.

**Inputs:**
- The sprint goal file for the window that just closed: `.squad/sprints/{YYYY-MM-DDThh}Z.md`
- Issues closed inside the 6h window
- PRs merged inside the 6h window
- Any `process` issues opened during the sprint
- Recent entries in `.squad/retro-log.md` (per-PR micro-retros from Scribe)
- `.squad/velocity.md` if fresh

**Agenda:**
1. **Sprint goal status** — did we hit what the sprint note said? Carry-over list.
2. **What went well** — velocity hit, green PRs, smooth reviews.
3. **What didn't** — CI failures, rejected DPs, rework cycles, stuck PRs, gate skips.
4. **Action items** — each concrete, testable, and filed as a new `process` issue (one per action).
5. Scribe captures the summary.

**Output:** **appended as a comment** to a rolling per-day issue titled `Cadence Retro · {YYYY-MM-DD}` (one issue per UTC day, up to four retro comments bucketed into it — one per 6h sprint). This prevents spamming four new issues every day. The comment contains the agenda summary, the closed 6h window (e.g. `Sprint 2026-04-21T12Z → 2026-04-21T18Z`), the linked inputs, and the list of filed `process` action-item issues. Scribe creates the daily rolling issue on the first retro of each UTC day.

---

## Failure Retrospective

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | after |
| **Condition** | build failure, test failure, or reviewer rejection |
| **Facilitator** | Leela |
| **Participants** | all-involved, Nibbler for code quality analysis |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. What happened? (facts only)
2. Root cause analysis
3. What should change? (concrete, testable)
4. Open a `process` issue for each action item → daily pulse tracks them

---

## Docs Sweep

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | monthly |
| **Condition** | first docs hygiene pass of the month, or manual trigger when docs drift is suspected |
| **Facilitator** | Scribe |
| **Participants** | all-relevant |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Goal:** Catch silent docs rot before it lands in charters, skills, the brief, or docs-site pages.

**Checklist:**
1. Broken links across repo docs and docs-site
2. Brief freshness: compare `Last updated:` in `docs-site/docs/architecture/v2-implementation-brief.md` against recent `packages/` churn
3. Pack-page completeness: each active pack page still lists current agents, skills, tools, user actions, components, guardrails, and dependencies
4. Charter relevance: role boundaries and owned artifacts still match current workflows
5. Skill accuracy: workflow-facing skills still match the real repo layout and ceremony gates

**Output:** Scribe records findings in the rolling `📚 Docs Sweep (rolling)` issue or opens focused `process` issues when drift needs follow-up work.

---

## Persona mechanism

When a workflow opens an issue, PR, or comment via @copilot, it:

1. Adds a `squad:{member}` label.
2. Starts the body with `Working as {Name} ({Role}) — see .squad/agents/{name}/charter.md`.
3. If delegating a task to @copilot, names the persona explicitly (`@copilot — work as Scribe`).

The existing `.github/copilot-instructions.md` tells @copilot to load the referenced charter and work in that voice. No additional plumbing needed.
