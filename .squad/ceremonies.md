# Ceremonies

Ceremonies are structured team interactions that the Squad coordinator triggers automatically before or after work. They are distinct from **automated workflows** (GitHub Actions), which run independently on schedule or events.

## Ceremony overview

| Ceremony | Trigger | When | Facilitator | Participants | Gate? |
|----------|---------|------|-------------|--------------|-------|
| Design Proposal | auto | before work | Leela | assigned agent | ✅ Blocks implementation until DP posted |
| Design Review | auto | before code | Leela | Zapp, Nibbler, all-relevant | ✅ Blocks code until approved |
| PR Review Gate | auto | before merge | Nibbler | Leela (architecture), Zapp (security), Hermes (tests) | ✅ Blocks merge until all feedback addressed |
| Docs Sweep | auto | monthly | Scribe | all-relevant | ❌ Freshness audit, not blocking |
| Retrospective | auto | after failure | Leela | Nibbler, all-involved | ❌ Diagnostic, not blocking |

## Automated workflows (not coordinator ceremonies)

These run via GitHub Actions on schedule or events. Documented here for reference but **not checked by the coordinator** in `before`/`after` ceremony logic.

| Workflow | When | File | Persona | Artifact |
|----------|------|------|---------|----------|
| Per-PR Micro-Retro | PR closed | `.github/workflows/squad-pr-retro.yml` | Scribe | `.squad/retro-log.md` + PR comment |
| Daily Pulse | cron `0 0 * * *` (17:00 PT) | `.github/workflows/squad-daily-pulse.yml` | Scribe | rolling issue `📊 Daily Pulse (rolling)` |
| Weekly Pulse | cron `0 0 * * 2` (Mon 17:00 PT) | `.github/workflows/squad-weekly-pulse.yml` | Scribe | new issue `Weekly Pulse · YYYY-MM-DD` |
| Monthly Docs Sweep | cron `0 0 2 * *` (~1st day 17:00 PT) | `.github/workflows/squad-monthly-docs-sweep.yml` | Scribe | rolling issue `📚 Docs Sweep (rolling)` |
| Release Cadence | cron `0 0 * * *` (17:00 PT) | `.github/workflows/squad-release-cadence.yml` | Leela + Scribe | draft PR on `release/cadence` branch |

All crons are UTC. `0 0 * * *` = 17:00 PDT / 16:00 PST.

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

**DP structure** (the implementing agent posts a comment with):
- Problem statement (cite the issue body)
- Proposed approach with a reference to the relevant brief section
- Pack boundaries affected
- Primitive surface changes: tools, user actions, components, guardrails
- Security considerations: schema changes, trust boundaries, secrets
- Test strategy
- Docs and changeset plan
- Alternatives considered

**Rules:**
- The issue body (problem + acceptance criteria) is written by the product owner or Lead. The DP (approach) is written by the implementing agent.
- Each PR maps to one issue. Split bundles.

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
| **Participants** | Leela (architecture), Zapp (security), Hermes (test coverage) |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Gate:** PR may NOT be merged until all review threads are resolved and all reviewers have approved.

**Review dimensions:**
1. **Nibbler** — code correctness, readability, bug patterns, error handling, naming
2. **Leela** — architecture alignment, pack boundaries, API contract consistency
3. **Zapp** — security surface, input validation, trust boundaries, secret handling
4. **Hermes** — test coverage for new/changed code, edge cases, regression risk

**Feedback labels:**
- `nibbler:approved` / `nibbler:rejected` — code quality gate
- `leela:approved` / `leela:rejected` — architecture gate
- `zapp:approved` / `zapp:rejected` — security gate

**Merge criteria:** All three approval labels present + CI green. Any rejection blocks merge and triggers revision by a different agent (per Reviewer Rejection Protocol).

**Feedback reply protocol (required for all reviewers and authors):**
1. When addressing any review comment, the author MUST reply to the specific comment with: "Addressed in {sha}: {description}"
2. After replying, resolve the thread via GitHub GraphQL API (`resolveReviewThread` mutation)
3. Verify 0 unresolved threads before attempting merge
4. Never silently fix and move on — a reply is required on every comment

This protocol applies to all agents (squad members AND @copilot). It is enforced by the coordinator and documented in `.github/copilot-instructions.md` for @copilot compliance.

---

## Retrospective

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
