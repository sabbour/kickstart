---
updated_at: 2026-04-21T13:45:00Z
mode: board-idle-after-sprint
focus_area: Overnight sprint 5+6 shipped, board idle, standing by for next direction
active_issues: []
blocked_issues: []
---

# What We're Focused On

**Overnight sprint complete: 19 issues / 26 PRs shipped in ~8h. Board IDLE. Ralph standing by.**

## Sprint 5 + 6 Summary (2026-04-21, overnight run)

**Shipped:**
- 19 issues closed
- 26 PRs merged
- 5 UI bugs (#991, #980, #995, #997, #998) + 4 process/security design PRs
- ~8 hours continuous delivery cycle

**Key PRs merged (sprint 5+6):**
- #1009 — #996 AKS _ErrorComponent fix (Bender)
- #1010 — #987 Playground E2E reintroduction (Fry)
- #1008 — #808 retro extension for SLO triggers
- #1011 — #806 quality SLO safety brake (process/governance)
- #1012 — #792 retro metrics via env (workflow hardening)
- #1013 — #1006 insertSvgSafely hardening (security)
- #1014 — #805 process grader workflow (learning loop)

**Process improvements shipped:**
- ✅ Bundle-budget ceiling gate (proven pattern)
- ✅ Named-constant geometry SSoT (proven pattern)
- ✅ Parametrised tool-conformance test (proven pattern)
- ✅ Trio-agent improvement (diff-delta education needed)
- ✅ Label deletion protocol (on re-review flip verdicts)

## Current Status

**Board:** IDLE  
**Sprint Planning:** Deferred; Ralph standing by for next scope-out  
**Waiting On:** Asabbour (still asleep); team capacity reset

## Key Learnings (Round 4 Retrospective)

[See `.squad/retro-log.md` for detailed round-4 learnings — brief summary here]

1. **Stale agent verdicts:** Leela reported CI "red" on PR #1000 post-rebase when it was actually green. **Lesson:** Always verify live CI state before acting on cached agent reports. Workaround: have each agent poll `gh run list` or equivalent for the specific PR before posting verdict.

2. **Edit-but-not-commit hazard:** Bender's rebase (fc60b872 → 6b8f17e3) included test-import fixes in the working tree but not committed. Local tests passed (saw the edits), but CI failed (no edits in index). **Lesson:** Enforce "commit early and often" discipline during rebases. Flag stale `git status` output in code-review if working-tree is dirty.

3. **Approval-label loss on synchronize:** Push to PR after rebase stripped all review labels (nibbler/leela/zapp). This is GitHub default behavior but broke the "auto-merge on label" contract. **Lesson:** Plan an explicit relabel pass into the PR merge ceremony. Current workaround: contributor manually re-requests review or Scribe force-adds labels via REST. Consider a bot pass that re-applies labels if the reviewer is still marked as a reviewer.

4. **Worktree hygiene:** `.worktrees/` has accumulated stale checkouts (fry-987, bender-996, etc.). Each branch that landed was not cleaned up. **Lesson:** Add a "cleanup stale worktrees" step to the squad meeting cadence (e.g. weekly housekeeping task). Command: `git worktree list`, then `git worktree remove .worktrees/X` + `git worktree prune`.

5. **Bundle-budget gate proved:** PR #1000's bundle-budget ceiling (`check-bundle-budget.mjs` post-build CI + waiver-by-PR-description) worked cleanly. This is now the approved pattern for any controlled performance overages. ✅ Proven shape.

6. **Named-constant geometry SSoT:** Playground layout constants module (consumed by CSS + unit test + Playwright in #1003/#1004) prevents test-drift-no-op failures. This is now the approved pattern for any Playground or flex-layout regressions. ✅ Proven shape.
