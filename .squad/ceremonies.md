# Ceremonies

> Team meetings that happen before or after work. Each squad configures their own.

## Design Review

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before |
| **Condition** | multi-agent task involving 2+ agents modifying shared systems |
| **Facilitator** | lead |
| **Participants** | all-relevant |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. Review the task and requirements
2. Agree on interfaces and contracts between components
3. Identify risks and edge cases
4. Assign action items

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
2. Assess open issues by priority (P0 → P1 → P2) and estimate
3. Group issues into milestones aligned with semver releases
4. Set milestone on each issue via GitHub API
5. Identify dependencies and blockers
6. Assign sprint capacity per agent based on estimates
7. Output: milestone roadmap with release targets

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
4. What went well?
5. What should change?
6. Action items for next sprint
