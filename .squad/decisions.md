
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
=== bender-continuous-deploy.md ===
# Decision: Continuous SWA deployment from main + version-SHA footer

**Author:** Bender (Backend Dev)
**Date:** 2026-04-14
**PR:** #177

## Context

SWA deployment only triggered on release tags (`v*`) and PRs, meaning changes merged to `main` didn't deploy until a release was cut. Ahmed needed immediate deployment on every merge.

## Decisions

1. **Push-to-main trigger** — `deploy-swa.yml` now triggers on `push → branches: [main]` with path filters (`packages/**`, `package.json`, `package-lock.json`, `tsconfig.json`). Tag-based releases still trigger deployment as before.

2. **Unified version string** — `__BUILD_VERSION__` is now `{semver}-{shortSHA}` (e.g. `0.5.6-abc1234`). Git SHA is resolved via `git rev-parse --short HEAD` at build time, falling back to `GITHUB_SHA` env var, then `dev`.

3. **Footer simplification** — Landing and Playground footers show the unified version string instead of version + SHA separately. Every build is uniquely identifiable.

## Impact

- Every push to `main` that touches package code auto-deploys to SWA
- Release workflow unchanged — tag pushes still work
- Fry: footer components (`Landing.tsx`, `Playground.tsx`) now use `__BUILD_VERSION__` only (SHA embedded)

=== bender-project-board-triage.md ===
# Decision: Project board auto-assignment in triage pipeline

**Date:** 2026-04-14T13:04:54.232Z
**Author:** Bender (Backend Dev)
**Status:** Implemented

## Context

Issues created by Ahmed were not being added to the GitHub project board
(https://github.com/users/sabbour/projects/3) or assigned milestones.

## Decision

1. **Project board:** All three triage workflows (squad-triage, squad-heartbeat,
   squad-issue-assign) now add issues to the project board automatically using
   the GraphQL `addProjectV2ItemById` mutation via `COPILOT_ASSIGN_TOKEN`.

2. **Milestones:** NOT auto-assigned. Milestones require judgment (which release?
   which sprint?). The Lead must assign milestones during in-session triage per
   the new Triage Checklist in routing.md.

3. **Graceful fallback:** All project board operations are wrapped in try/catch --
   if the API call fails, the workflow logs a warning but does not fail.

## Affected Files

- `.github/workflows/squad-triage.yml`
- `.github/workflows/squad-heartbeat.yml`
- `.github/workflows/squad-issue-assign.yml`
- `.squad/routing.md`

=== bender-remove-pr-preview-deploys.md ===
# Decision: Remove PR preview deployments from SWA workflow

**Date:** 2026-04-14
**Author:** Bender (Backend Dev)
**Status:** Implemented

## Context

SWA auth relies on domain filtering — staging preview URLs break login.

## Decision

Removed pull_request trigger, close_staging job, and pull-requests:write permission.

## Consequences

PRs no longer trigger SWA deployments, saving CI minutes.

=== copilot-directive-2026-04-14T130043Z.md ===
### 2026-04-14T13:00:43Z: User directive — Stop deploying PRs to SWA

**By:** Ahmed Sabbour (via Copilot)
**What:** Stop deploying pull requests to Azure Static Web Apps. Domain filtering breaks the login mechanisms (SWA auth requires the correct domain), making PR preview deployments useless and a waste of CI time.
**Why:** User request — captured for team memory

=== copilot-directive-2026-04-14T130530Z.md ===
### 2026-04-14T13:05:30Z: User directive — Comment when addressing feedback

**By:** Ahmed Sabbour (via Copilot)
**What:** Whenever an agent starts addressing PR review feedback or issue feedback, it must post an acknowledgment comment on the PR or issue (using its bot identity) before making changes. This makes the feedback loop visible to humans watching the repo.
**Why:** User request — captured for team memory

=== copilot-directive-2026-04-14T192924Z.md ===
### 2026-04-14T19:29:24Z: User directive
**By:** Ahmed Sabbour (via Copilot)
**What:** Drop the "I chose" prefix from button click / ChoicePicker selection messages. The user message should just say the selected value (e.g., "Selected: Web API / REST service"), not "I chose: ...".
**Why:** User request — captured for team memory

=== fry-browser-back-button.md ===
# Decision: Hash-based Navigation with History API

**Author:** Fry (Frontend Dev)
**Date:** 2026-04-14T17:01:56.521Z
**Context:** Browser back button support for session navigation

## Decision

Use **hash-based routing** (`#session/{id}`) with the History API (`pushState`/`popstate`) for client-side navigation between the landing page and chat sessions.

## Rationale

1. **Hash routing over path routing** — avoids server-side configuration changes. The SWA (Static Web App) doesn't need catch-all redirect rules since the hash never hits the server.
2. **Single `useNavigation` hook** — centralises all history management so every nav path goes through the same API (`pushSession`, `pushLanding`, `replaceCurrent`).
3. **Deep-link support** — users can bookmark or share `#session/{id}` URLs. On load, the app restores the session from localStorage if available, or falls back to landing.

## Implications

- All future navigation paths (e.g., settings page, playground) should follow the same hash pattern through the `useNavigation` hook.
- Session IDs appear in the URL — they're opaque random strings so this is fine for now, but if we ever use meaningful IDs we should consider privacy implications.

