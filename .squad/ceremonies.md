# Ceremonies

Every ceremony is automated via GitHub Actions. No ceremony depends on a human remembering. Agents adopt personas via the `squad:{member}` label plus a body header so @copilot loads the right charter.

## Automation map

| Ceremony | When | Workflow | Persona | Artifact |
|----------|------|----------|---------|----------|
| Design Review | DP comment on issue, or 2+ agents touching shared systems | manual spawn by Squad | Leela + Zapp | comments on issue |
| Per-PR Micro-Retro | PR closed (merged or not) | `.github/workflows/squad-pr-retro.yml` | Scribe | appended line in `.squad/retro-log.md` + PR comment |
| Failure Retro | build / test / review rejection | auto, ad-hoc in-session | Lead + involved | comment on issue or PR |
| Daily Pulse | every day 17:00 Pacific | `.github/workflows/squad-daily-pulse.yml` | Scribe | rolling issue `📊 Daily Pulse (rolling)` |
| Weekly Pulse | every Monday 17:00 Pacific | `.github/workflows/squad-weekly-pulse.yml` | Scribe | new issue `Weekly Pulse · YYYY-MM-DD` |
| Release Cadence | every day 17:00 Pacific | `.github/workflows/squad-release-cadence.yml` | Leela (Scribe curates notes) | draft PR on `release/cadence` branch |

All crons are UTC. `0 0 * * *` = 17:00 PDT / 16:00 PST. Shift to `0 1 * * *` during PST if you want precise 17:00 local year-round.

---

## Design Review

| Field | Value |
|-------|-------|
| **Trigger** | auto (in-session) |
| **When** | before implementation |
| **Condition** | DP comment posted on an issue, OR 2+ agents modifying shared systems |
| **Facilitator** | Leela |
| **Participants** | all-relevant, Zapp for security |
| **Time budget** | focused |

**Agenda:**
1. Review the DP comment on the issue
2. Leela evaluates architecture alignment with `docs/v2-implementation-brief.md`
3. Zapp evaluates security surface (tool schemas, guardrails, trust boundaries)
4. Agree on pack boundaries and primitive surface
5. Identify risks and edge cases
6. Both approve → implementation proceeds
7. Decisions captured as comments on the issue

---

## Per-PR Micro-Retro (automated)

| Field | Value |
|-------|-------|
| **Trigger** | `pull_request: types: [closed]` |
| **When** | after PR close |
| **Facilitator** | Scribe |
| **Workflow** | `.github/workflows/squad-pr-retro.yml` |

**What it does:**
- Computes size (S/M/L/XL), implementation minutes, review minutes, review cycles, outcome.
- Appends one line to `.squad/retro-log.md`.
- Comments the same line on the closed PR for visibility.

This is the data source for every pulse. Do not hand-edit `retro-log.md`.

---

## Failure Retro (ad-hoc)

| Field | Value |
|-------|-------|
| **Trigger** | build failure, test failure, reviewer rejection |
| **When** | after |
| **Facilitator** | Leela |
| **Participants** | all-involved |

**Agenda:**
1. What happened? (facts only)
2. Root cause
3. What should change? (concrete, testable)
4. Open a `process` issue for each action item → daily pulse tracks them

---

## Daily Pulse (automated)

| Field | Value |
|-------|-------|
| **Trigger** | `schedule: cron '0 0 * * *'` (17:00 Pacific) |
| **When** | daily |
| **Facilitator** | Scribe |
| **Workflow** | `.github/workflows/squad-daily-pulse.yml` |

**What it does:**
- Updates a **single rolling issue** (`📊 Daily Pulse (rolling)`) rather than opening new issues.
- Shows: PRs closed in the last 24h, open PRs aging > 3 days, open `process` issues.
- Pulled from `.squad/retro-log.md` + live GitHub state.

---

## Weekly Pulse (automated)

| Field | Value |
|-------|-------|
| **Trigger** | `schedule: cron '0 0 * * 2'` (Monday 17:00 Pacific) |
| **When** | weekly |
| **Facilitator** | Scribe |
| **Workflow** | `.github/workflows/squad-weekly-pulse.yml` |

**What it does:**
- Opens a fresh issue titled `Weekly Pulse · YYYY-MM-DD`.
- Summarises the prior 7 days: merged/closed/rework counts, median review time, size mix, PR list.
- Ends with a single prompt to the team: **Anything we should change?**
- Replies that warrant work get converted to `process` issues by Leela.

---

## Release Cadence (automated)

| Field | Value |
|-------|-------|
| **Trigger** | `schedule: cron '0 0 * * *'` (17:00 Pacific) |
| **When** | daily |
| **Facilitator** | Leela (Scribe curates release notes) |
| **Workflow** | `.github/workflows/squad-release-cadence.yml` |

**What it does:**
- Checks for pending changesets. If none, exits quietly.
- If pending, creates branch `release/cadence`, runs `npm run version`, force-pushes, opens a draft PR assigned `squad:leela` with a comment addressed to @copilot asking it to **work as Scribe** and curate the release notes.
- Idempotent: if a release PR is already open, the workflow no-ops.
- **No deploy is triggered by this workflow.** Main is pre-prod. Merging the release PR to main runs main's normal deploy path.

See `.squad/extensions/kickstart-aks-dev/skills/release-process.md` for the full release workflow.

---

## Persona mechanism

When a workflow opens an issue, PR, or comment via @copilot, it:

1. Adds a `squad:{member}` label.
2. Starts the body with `Working as {Name} ({Role}) — see .squad/agents/{name}/charter.md`.
3. If delegating a task to @copilot, names the persona explicitly (`@copilot — work as Scribe`).

The existing `.github/copilot-instructions.md` tells @copilot to load the referenced charter and work in that voice. No additional plumbing needed.
# Ceremonies

> Team meetings that happen before or after work. Each squad configures their own.

## Design Review

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before |
| **Condition** | Design Proposal (DP) comment posted on an issue, OR multi-agent task involving 2+ agents modifying shared systems |
| **Facilitator** | lead |
| **Participants** | all-relevant, Zapp (security input) |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. Review the Design Proposal (DP) comment on the issue
2. Leela evaluates architecture quality and alignment
3. Zapp evaluates security concerns and threat surface
4. Agree on interfaces and contracts between components
5. Identify risks and edge cases
6. Both approve → implementation proceeds
7. Capture decisions as comments on the issue (or as a GitHub Discussion if cross-issue)

---

## Retrospective

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | after |
| **Condition** | build failure, test failure, or reviewer rejection |
| **Facilitator** | lead |
| **Participants** | all-involved |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. What happened? (facts only)
2. Root cause analysis
3. What should change?
4. Action items for next iteration

---

## Sprint Planning

| Field | Value |
|-------|-------|
| **Trigger** | manual |
| **When** | before |
| **Condition** | user requests sprint planning, or at the start of a new milestone |
| **Facilitator** | lead |
| **Participants** | all-active |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. Review completed work from previous sprint/milestone
2. **Historical time analysis:** Read orchestration logs from the previous sprint to compute actual durations per issue — total time, feedback time, and implementation-only time. Group by issue size/complexity to build a reference table (e.g., "small fix ≈ 5 min, medium feature ≈ 25 min, large feature ≈ 60+ min")
3. Assess open issues by priority (P0 → P1 → P2) and estimate — **calibrate estimates against historical time data** from step 2. Compare proposed estimates with actual durations of similar past issues
4. Group issues into milestones aligned with semver releases
5. Set milestone on each issue via GitHub API
6. Identify dependencies and blockers
7. Assign sprint capacity per agent based on **time-calibrated estimates**
8. Output: milestone roadmap with release targets and time budget

**Artifacts:** Create a GitHub Discussion (or milestone comment) linking to the sprint plan. Include the sprint goal, issue list, wave breakdown, capacity estimates, and a **time reference table** showing historical size→duration data from past sprints.

---

## Sprint Retro

| Field | Value |
|-------|-------|
| **Trigger** | manual |
| **When** | after |
| **Condition** | user requests sprint retro, or after a release is tagged |
| **Facilitator** | lead |
| **Participants** | all-involved |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. What shipped? (milestone summary)
2. What slipped? (issues that moved between milestones)
3. Velocity check: estimated vs actual story points
4. **⏱️ Time analysis** — read orchestration logs and PR descriptions from this sprint to compile:
   - Per-issue time breakdown: implementation time vs feedback time vs total time
   - Per-agent time totals (who spent how much time)
   - Issue size → actual duration mapping (build the reference table for Sprint Planning)
   - Feedback overhead ratio: what % of total time was spent addressing review feedback
   - Outliers: issues that took significantly longer or shorter than expected — root-cause why
5. **Size calibration** — classify completed issues into size buckets (S/M/L/XL) and compute median duration per bucket. Compare against previous sprint's reference table to track estimation accuracy over time
6. What went well?
7. What should change?
8. Action items for next sprint

**Artifacts:** Create a GitHub Discussion (or milestone comment) with the retro summary, including:
- Time breakdown table (issue # | title | size | impl time | feedback time | total time | estimate | delta)
- Size→duration reference table (updated with this sprint's data)
- Feedback overhead analysis
- Estimation accuracy trend (if prior sprint data exists)
