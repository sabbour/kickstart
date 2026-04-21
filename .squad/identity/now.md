---
updated_at: 2026-04-21T05:30:00Z
mode: bug-shipping-then-feature-unblock
focus_area: UI bug shipping velocity, schema conformance, bundle ceiling enforcement
active_issues: [996, 987]
blocked_issues: []
---

# What We're Focused On

**Round 4 complete: 5 UI bugs shipped (#991/#980/#995/#997/#998). Now unblocking #996 + #987. Schema conformance CI gate in place. Bundle-ceiling enforcement proved.**

## Current Status

### Just Shipped (April 21, round 4)

- **#991** ✅ — Pack no-previews (fixed in #1001)
- **#980** ✅ — Workflow revert (merged in round 3)
- **#995** ✅ — Core tab tight rendering + preview coverage (PR #1003 merged; playground-layout-constants module is new SSoT for geometry)
- **#997** ✅ — Workspace black void (PR #1004 merged; `min-height: 0` flex discipline applied)
- **#998** ✅ — Chat broken, A2UI v0.9 schema strict-required (PR #1005 merged; parametrised conformance test now covers every pack-core tool)

### In Flight (high priority)

1. **#996** — AKS _ErrorComponent, inspiration prompts unreliable. Assigned: Bender. Depends on #998 conformance test passing (which it does). Root cause: allow-list drift between LLM system prompt and ClientComponentRegistry. [See #990 defense-in-depth test pattern]

2. **#987** — Playground E2E regression: previously-skipped #772 scenario suite. Assigned: Fry. Must use geometry-constants module + named-viewport patterns from #1003/#1004. Expectation: 3 new Playwright test groups, 12+ cases.

3. **Zapp follow-up — insertSvgSafely guardrail** (filed by Zapp during round 4 review). Future pack-core tools will use this utility for any SVG/XML content. Blocks future pack feature work; low priority until such feature is in scope.

### Next Sprint (Ralph round 3 scan in progress)

- Identify next 3–5 fixable issues from public board + internal tech debt.
- Sprint planning ceremony deferred pending #996/#987 closure.

## Key Learnings (Round 4 Retrospective)

[See `.squad/retro-log.md` for detailed round-4 learnings — brief summary here]

1. **Stale agent verdicts:** Leela reported CI "red" on PR #1000 post-rebase when it was actually green. **Lesson:** Always verify live CI state before acting on cached agent reports. Workaround: have each agent poll `gh run list` or equivalent for the specific PR before posting verdict.

2. **Edit-but-not-commit hazard:** Bender's rebase (fc60b872 → 6b8f17e3) included test-import fixes in the working tree but not committed. Local tests passed (saw the edits), but CI failed (no edits in index). **Lesson:** Enforce "commit early and often" discipline during rebases. Flag stale `git status` output in code-review if working-tree is dirty.

3. **Approval-label loss on synchronize:** Push to PR after rebase stripped all review labels (nibbler/leela/zapp). This is GitHub default behavior but broke the "auto-merge on label" contract. **Lesson:** Plan an explicit relabel pass into the PR merge ceremony. Current workaround: contributor manually re-requests review or Scribe force-adds labels via REST. Consider a bot pass that re-applies labels if the reviewer is still marked as a reviewer.

4. **Worktree hygiene:** `.worktrees/` has accumulated stale checkouts (fry-987, bender-996, etc.). Each branch that landed was not cleaned up. **Lesson:** Add a "cleanup stale worktrees" step to the squad meeting cadence (e.g. weekly housekeeping task). Command: `git worktree list`, then `git worktree remove .worktrees/X` + `git worktree prune`.

5. **Bundle-budget gate proved:** PR #1000's bundle-budget ceiling (`check-bundle-budget.mjs` post-build CI + waiver-by-PR-description) worked cleanly. This is now the approved pattern for any controlled performance overages. ✅ Proven shape.

6. **Named-constant geometry SSoT:** Playground layout constants module (consumed by CSS + unit test + Playwright in #1003/#1004) prevents test-drift-no-op failures. This is now the approved pattern for any Playground or flex-layout regressions. ✅ Proven shape.
