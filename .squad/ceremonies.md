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
