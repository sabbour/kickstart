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
