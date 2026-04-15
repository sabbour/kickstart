
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
=== bender-continuous-deploy.md ===

---

# Decision: Continuous SWA deployment from main + version-SHA footer

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

### CI Workflow paths-ignore Removal
**Author:** Bender (Backend Dev)
**Date:** 2026-04-15
**Status:** Implemented

Removed paths-ignore from `.github/workflows/ci.yml` to ensure all PRs trigger CI checks. The protect-main ruleset requires 'Lint, Build & Unit Tests' and 'Playwright E2E Tests' to pass, but docs-only files were excluded, causing merge deadlocks.

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
=== bender-project-board-triage.md ===
---

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
---

# Decision: Remove PR preview deployments from SWA workflow

**Date:** 2026-04-14
**Status:** Implemented

- Issues auto-added to GitHub project board via `addProjectV2ItemById`
- Milestones NOT auto-assigned (require human judgment)
- Graceful fallback: failed API calls log warnings but don't fail workflow
- Affected: `squad-triage.yml`, `squad-heartbeat.yml`, `squad-issue-assign.yml`
## Context

SWA auth relies on domain filtering — staging preview URLs break login.

## Decision

Removed pull_request trigger, close_staging job, and pull-requests:write permission.

## Consequences

PRs no longer trigger SWA deployments, saving CI minutes.

=== copilot-directive-2026-04-14T130043Z.md ===
---

### 2026-04-14T13:00:43Z: User directive — Stop deploying PRs to SWA

**By:** Ahmed Sabbour (via Copilot)
**What:** Stop deploying pull requests to Azure Static Web Apps. Domain filtering breaks the login mechanisms (SWA auth requires the correct domain), making PR preview deployments useless and a waste of CI time.
**Why:** User request — captured for team memory

=== copilot-directive-2026-04-14T130530Z.md ===
---

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
---

# Decision: Hash-based Navigation with History API

### Hash-Based Navigation with History API
**Author:** Fry (Frontend Dev)
**Date:** 2026-04-14
**Context:** Browser back button support

- Hash routing (`#session/{id}`) with History API (`pushState`/`popstate`)
- Avoids server-side SWA configuration changes
- Centralised `useNavigation` hook for all history management
- Deep-link support: users can bookmark `#session/{id}` URLs
- All future navigation paths should follow this pattern
---

# Decision: DP Reviews — Public Skills (#186) and Onboarding Tour (#187)

**Author:** Leela (Lead)
**Date:** 2026-04-14

## Context

Two Design Proposals reviewed and approved with conditions.

## Decisions

### DP #186 — Public Copilot Skill Support
1. **Build-time bundling via CLI command** — `npm run sync-public-skills` fetches SKILL.md files, parses to Skill[], commits output. No Vite plugin, no runtime fetch.
2. **Virtual IntegrationKit pattern** — public skills wrapped in a kit registered via `registerKit()`. Zero changes to `resolveSkills()` or `buildSystemPrompt()`.
3. **Phase auto-mapping** — use `classifyPrompt()` heuristics with `phaseOverrides` config as escape hatch.
4. **Reference sub-docs ignored** — only SKILL.md body (≤500 tokens) ingested. Sub-docs are a follow-up.
5. **Public skill priority: -5** — first-party kit skills win on conflict.
6. **Config in packages/web only** — IDE consumes public skills natively via extensions.
7. **Namespace prefix mandatory** — `ghca:{skill-name}` format to prevent ID collisions.
8. **Use existing YAML parser** — no custom frontmatter-parser module.

### DP #187 — Guided Onboarding Tour
1. **Option A: split tour** — steps 1-2 on Landing, steps 3-4 triggered on first chat entry. Minimal state machine (currentStep + mode check).
2. **Standalone TourContext** — follows DebugContext/ThemeContext pattern. No UserPreferencesContext consolidation yet.
3. **No clickable example prompts in tour** — tour explains and points; user interacts with actual UI. Clickable prompts are a separate Landing enhancement.
4. **requestIdleCallback for auto-start** — not a fixed setTimeout delay.
5. **4 steps maximum** — scope locked. Expansion requires a new issue.
6. **Existing CSS targets** — use `.landing-hero`, `.landing-tracks`, `.chat-phase`, `.chat-input-area` directly. No new classes on existing components.

---

# Zapp Security Decision — Public Skills Trust Boundary

**Date:** 2026-04-14T17:32:34.141Z  
**Author:** Zapp (Security Architect)  
**Scope:** DP #186 public Copilot skill ingestion

## Decision
Public skill ingestion is approved in principle only if external skill sources are treated as untrusted content crossing into control-plane prompt assembly.

## Required Controls
1. **Immutable source pinning**: production configs must pin each source to a commit SHA (or signed immutable tag), not moving branches like `main`.
2. **Prompt-safety validation**: imported `SKILL.md` content must pass policy checks aimed at instruction-level prompt injection; HTML/script stripping alone is insufficient.
3. **Fail-closed + provenance**: sync must fail on parse/policy violations and persist source provenance (`repo`, `sha`, `path`, `fetchedAt`) for audit/incident response.

## Rationale
The feature introduces a new supply-chain ingress path and trust-boundary crossing from third-party markdown into system prompt context. These controls preserve deterministic builds while reducing tampering and prompt-injection risk to an acceptable level.
