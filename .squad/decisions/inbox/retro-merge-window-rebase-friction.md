# DP: Reduce sequential-merge rebase friction with a merge window protocol

**Status**: Draft — awaiting @asabbour_microsoft review
**Proposed by**: Leela (squad-lead)
**Category**: process

## Problem

During Phase 2 and Phase 3 delivery, `dev` received 2–3 merges per merge window. Agents working on a branch that was opened before the previous merge would have to rebase at least once, and sometimes twice, before their own PR could land. Each rebase round-trips through: fetch → rebase → push → re-request review → wait for CI. With 10–15 minute CI runs, two rebases add 20–30 minutes of dead time per PR.

Observed examples:
- PRs #395, #396, #397, #398 landed in rapid succession during a single session. PRs opened earlier in the same session had to rebase after each merge.
- PR #399 (fast-lane hotfix) was merged while PRs #400 and #401 were in review; both required a rebase after #399 landed.

This friction is a multiplier: with ~20 active squad branches, a burst of 3 merges creates up to 20 rebase tasks. The current `squad-workflows update_branch` tool addresses it reactively but not proactively.

## Proposal

Adopt a **merge-window batching** convention with three parts:

1. **Declare a merge window** — when Leela or the coordinator intends to merge multiple PRs in one session, announce it in a comment on the relevant PRs: "Merging this PR in a batch with #X, #Y, #Z. All rebases will happen after the full batch is assembled." This gives agents working on other branches a chance to delay their push until the window closes.

2. **Sequence by dependency, not by review completion** — Leela reviews the dependency graph before the window and orders merges so that a PR is never merged if a sibling PR it logically depends on is still open. This prevents artificial rebase pressure between PRs that could have been sequenced correctly from the start.

3. **Document the merge-window protocol** in `.squad/ceremonies.md` under a new "Merge Window" section, and add a note to `pr-workflow.md`: "If you push a branch while a merge window is in progress, expect a rebase request within minutes. Delay your push or be ready to rebase immediately."

No tooling changes are required in Phase 1; this is process only. If the pattern persists, Kif can automate the merge-order scheduling in a future wave.

## Impact

- **All agents** (Bender, Fry, Hermes) who open PRs during high-merge-velocity sessions.
- **Leela** — owns the merge window declaration and sequencing.
- **Kif** — optional follow-on: automate merge ordering via GitHub Actions.
- No CI changes, no code changes.

## Alternatives considered

- **Merge queue (GitHub native)**: GitHub's merge queue serialises merges automatically. Evaluated but not adopted because it requires branch protection rule changes (Kif's domain) and adds latency for every merge, not just burst windows. Worth revisiting if burst frequency increases.
- **Rebase-on-merge only**: Already the policy. The issue is frequency, not the rebase mechanism itself.
- **Monorepo-aware merge scheduling**: Over-engineered for current team size. Revisit at >5 concurrent active branches per session.
