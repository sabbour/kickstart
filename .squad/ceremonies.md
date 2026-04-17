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
