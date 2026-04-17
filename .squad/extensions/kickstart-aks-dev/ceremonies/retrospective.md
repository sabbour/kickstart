# Retrospective

Three formats. Two are automated. Only the incident retro is human-driven, and only when things break.

## 1. Per-PR micro-retro (automated)

Runs on every PR close via `.github/workflows/squad-pr-retro.yml`. Scribe appends one line to `.squad/retro-log.md` with size, implementation minutes, review minutes, review cycles, outcome. The same line is mirrored as a PR comment. No human ceremony.

This is the data layer. Everything else reads from it.

## 2. Incident retrospective (in-session, ad-hoc)

**Trigger:** build failure, test failure, or a reviewer rejection that cost a rework cycle.
**Facilitator:** Leela
**Participants:** everyone involved in the failure.

### Agenda

1. What happened? Facts only, no blame.
2. Root cause. Trace back to the decision that caused it.
3. What should change? One concrete, testable action per root cause.
4. Open a `process` issue for each action item. The daily pulse tracks them.

## 3. Weekly pulse (automated, see `ceremonies.md`)

Replaces the old manual "sprint retro." Every Monday at 17:00 Pacific, `.github/workflows/squad-weekly-pulse.yml` opens an issue summarising the prior 7 days from `retro-log.md`:

- Merged vs closed vs merged-with-rework
- Median review time
- Size mix (S/M/L/XL)
- Aging PRs
- A single prompt: **Anything we should change?**

Replies that warrant work get converted to `process` issues by Leela. No separate retro meeting is required.

## Why we dropped manual sprint retros and planning

The old ceremonies depended on someone remembering to run them. They didn't happen reliably. The automated model trades a recurring meeting for a rolling data stream plus one weekly question. Less ceremony, more signal.

If you want deeper analysis (size→duration calibration, estimation accuracy), read the weekly pulse history. Four weeks of data tells you more than one meeting.
# Retrospective

Two retrospective formats: **incident retro** (auto-triggered) and **sprint retro** (manual/post-release).

---

## Incident Retrospective

**Trigger:** Auto — after build failure, test failure, or reviewer rejection.
**Facilitator:** Lead (Leela)
**Participants:** All agents involved in the failure

### Agenda

1. **What happened?** — Facts only, no blame
2. **Root cause analysis** — Trace back to the decision or change that caused the failure
3. **What should change?** — Process improvements, guard rails, new checks
4. **Action items** — Concrete tasks with owners for the next iteration

---

## Sprint Retrospective

**Trigger:** Manual — after a release is tagged or user requests a retro.
**Facilitator:** Lead (Leela)
**Participants:** All agents involved in the sprint

### Agenda

1. **What shipped?** — Milestone summary with issue list
2. **What slipped?** — Issues that moved between milestones
3. **Velocity check** — Estimated vs actual story points
4. **Wall-clock time vs estimates** — Per issue and per wave (user directive: must be included)
5. **What went well?**
6. **What should change?** — Process improvements
7. **Review process efficiency** — Capture PR review bottlenecks (e.g., Copilot reviewer always COMMENTED not APPROVED)
8. **Action items** — Concrete tasks for next sprint

### Artifacts

Create a GitHub Discussion (or milestone comment) with the retro summary, including:
- Wall-clock vs estimate analysis
- Velocity metrics
- Review process efficiency notes
- Action items with owners

---

## Sprint Planning

**Trigger:** Manual — at the start of a new milestone or user request.
**Facilitator:** Lead (Leela)
**Participants:** All active agents

### Agenda

1. **Review completed work** from previous sprint/milestone
2. **Assess open issues** by priority (P0 → P1 → P2) and estimate (Fibonacci scale)
3. **Group issues into milestones** aligned with semver releases
4. **Set milestone on each issue** via GitHub API
5. **Identify dependencies and blockers**
6. **Assign sprint capacity** per agent based on estimates
7. **Output:** Milestone roadmap with release targets

### MMM Alignment

Per user directive, sprints follow MMM (Missions, Milestones, Metrics) process:
- Every sprint delivers a **shippable, testable, usable milestone** — not just merged PRs
- Missions must be **measurable and falsifiable**
- RAG status per mission
- Every cycle is a learning opportunity
