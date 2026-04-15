
**What went well:**
- Bot identity system working — reviews posted as `sabbour-squad-lead[bot]`.
- Parallel reviewer spawning effective — reviewers + implementation ran simultaneously.
- 10 issues closed in one session — highest throughput sprint to date.
- Security gate caught real issues: `Buffer` usage in browser (Node-only API), path traversal risks.

---

## 2. Root Cause Analysis

### RCA-1: Agent spawn time dominated by context reading
- **Symptom:** 9 min gap between DP approval and PR.
- **Root cause:** Agents read 287 KB of history/decisions at spawn. At ~500 tokens/KB, that's ~143K tokens of context before a single line of code. LLM inference on that volume is slow and expensive.
- **Why it grew:** Scribe summarization threshold is 15 KB, but files grew past 40 KB. Compaction runs after sprints, not before. Agents start with accumulated cruft from previous sprints.

### RCA-2: Process ceremony too heavy for trivial fixes
- **Symptom:** CSS-only change (#161) went through full DP → architecture review → security review → code → PR review pipeline.
- **Root cause:** No fast-track path for changes below a complexity threshold. Every issue got the same ceremony regardless of risk or size.

### RCA-3: No progress visibility during implementation
- **Symptom:** Ahmed frustrated by silence between DP approval and PR appearing.
- **Root cause:** Agents create branch + commits + PR as a batch at the end. No draft PR or branch push happens early. GitHub shows nothing until the agent is completely done.

### RCA-4: Shared working tree causes git conflicts
- **Symptom:** Parallel agents stepping on each other's git state.
- **Root cause:** All agents share the same `main` checkout. No worktree isolation between parallel agent runs.

### RCA-5: Stale directives not loaded at sprint start
- **Symptom:** Agents skipped DP step; lockout protocol fired incorrectly.
- **Root cause:** Directives captured mid-sprint aren't retroactively applied to already-running agents. New agents pick them up, but running ones don't re-read context.

---

## 3. What Should Change

### C1: Pre-sprint context compaction ("the nap")
Run aggressive history compaction BEFORE sprints, not just after. Target: each history file ≤ 10 KB, decisions.md ≤ 30 KB. Agents should start clean.

**Rule:** Before any sprint, Scribe runs compaction. If total context > 50 KB, sprint does not start.

### C2: Fast-track path for trivial changes
Define a "trivial change" gate: CSS-only, typo fix, config change, rename, or single-file change with no logic. Trivial changes skip DP architecture review and security review. They still need code review (one reviewer, not two).

**Threshold:** ≤ 1 file changed, no new dependencies, no API surface change, no security-relevant code.

### C3: Draft PR within 30 seconds
Agents must create branch + draft PR immediately after DP approval, BEFORE writing code. This gives Ahmed a GitHub URL to watch within 30 seconds. Commits are pushed incrementally as work progresses.

**Sequence:** DP approved → create branch → push empty commit → open draft PR → implement → push commits → mark PR ready for review.
## 4. User Directives (April 2026)

### 2026-04-14T13:00:43Z: Stop deploying PRs to SWA
**By:** Ahmed Sabbour (via Copilot)
**What:** Stop deploying pull requests to Azure Static Web Apps. Domain filtering breaks the login mechanisms (SWA auth requires the correct domain), making PR preview deployments useless and a waste of CI time.
**Status:** Implemented in bender-remove-pr-preview-deploys.md

### 2026-04-14T13:05:30Z: Comment when addressing feedback
**By:** Ahmed Sabbour (via Copilot)
**What:** Whenever an agent starts addressing PR review feedback or issue feedback, it must post an acknowledgment comment on the PR or issue (using its bot identity) before making changes. This makes the feedback loop visible to humans watching the repo.

### 2026-04-14T21:38:43Z: Enforce PR review feedback gate
**By:** Ahmed Sabbour (via Copilot)
**What:** Stop skipping PR review feedback comments and stop skipping asking for reviews. All PRs must have Copilot review comments addressed before merging. Do not auto-merge without checking for and resolving review feedback first.
**Why:** The team has been shipping shoddy work by bypassing the review gate.

### 2026-04-15T01:44:20Z: ArchitectureDiagram styling alignment
**By:** Ahmed Sabbour (via Copilot)
**What:** The ArchitectureDiagram A2UI component should follow the directive and styling from the try-aks app implementation, not custom styling.
**Status:** Linked to Issue #255

### 2026-04-15T01:44:20Z: Button styling consistency
**By:** Ahmed Sabbour (via Copilot)
**What:** All action buttons rendered by A2UI components must use consistent Fluent UI button styling. Currently "Continue →", "Save Changes", "Revert", "Approve and continue", "Change something", "Deploy Now", "Preview", and "Cancel" buttons are visually inconsistent with the properly-styled "Submit" and "Format Date" buttons. Every button must follow the same Fluent UI appearance rules (primary, outlined, text variants).
**Status:** Linked to Issue #254

## 5. Decisions from Recent Sprints

### Continuous SWA Deployment + Version Footer
**Author:** Bender (Backend Dev)
**Date:** 2026-04-14
**PR:** #177
**Status:** Implemented

- Every push to `main` that touches package code auto-deploys to SWA
- Unified version string: `{semver}-{shortSHA}` (e.g., `0.5.6-abc1234`)
- Landing and Playground footers show unified version

### Project Board Auto-Assignment in Triage
**Author:** Bender (Backend Dev)
**Date:** 2026-04-14
**Status:** Implemented

- Issues auto-added to GitHub project board via `addProjectV2ItemById`
- Milestones NOT auto-assigned (require human judgment)
- Graceful fallback: failed API calls log warnings but don't fail workflow
- Affected: `squad-triage.yml`, `squad-heartbeat.yml`, `squad-issue-assign.yml`

### Hash-Based Navigation with History API
**Author:** Fry (Frontend Dev)
**Date:** 2026-04-14
**Context:** Browser back button support

- Hash routing (`#session/{id}`) with History API (`pushState`/`popstate`)
- Avoids server-side SWA configuration changes
- Centralised `useNavigation` hook for all history management
- Deep-link support: users can bookmark `#session/{id}` URLs
- All future navigation paths should follow this pattern
