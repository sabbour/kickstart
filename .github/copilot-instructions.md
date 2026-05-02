# Copilot Coding Agent — Squad Instructions

You are working on a project that uses **Squad**, an AI team framework. When picking up issues autonomously, follow these guidelines.

## Team Context

Before starting work on any issue:

1. Read `.squad/team.md` for the team roster, member roles, and your capability profile.
2. Read `.squad/routing.md` for work routing rules.
3. If the issue has a `squad:{member}` label, read that member's charter at `.squad/agents/{member}/charter.md` to understand their domain expertise and coding style — work in their voice.

## Capability Self-Check

Before starting work, check your capability profile in `.squad/team.md` under the **Coding Agent → Capabilities** section.

- **🟢 Good fit** — proceed autonomously.
- **🟡 Needs review** — proceed, but note in the PR description that a squad member should review.
- **🔴 Not suitable** — do NOT start work. Instead, comment on the issue:
  ```
  🤖 This issue doesn't match my capability profile (reason: {why}). Suggesting reassignment to a squad member.
  ```

## Branch Naming

Use the squad branch convention:
```
squad/{issue-number}-{kebab-case-slug}
```
Example: `squad/42-fix-login-validation`

## PR Guidelines

When opening a PR:
- Reference the issue: `Closes #{issue-number}`
- If the issue had a `squad:{member}` label, mention the member: `Working as {member} ({role})`
- If this is a 🟡 needs-review task, add to the PR description: `⚠️ This task was flagged as "needs review" — please have a squad member review before merging.`
- Follow any project conventions in `.squad/decisions.md`

## Decisions

If you make a decision that affects other team members, write it to:
```
.squad/decisions/inbox/copilot-{brief-slug}.md
```
The Scribe will merge it into the shared decisions file.

<!-- squad-workflows: start -->
## Workflow Tools (squad-workflows extension)

Use these tools for the issue-to-merge lifecycle:

**Planning:** `squad_workflows_estimate` → `squad_workflows_decompose` (if L/XL)
**Design:** `squad_workflows_post_design_proposal` → `squad_workflows_check_design_approval`
**Review:** `squad_workflows_check_feedback` + `squad_workflows_check_ci`
**Feedback Loop:** `squad_workflows_address_feedback` / `squad_workflows_address_all_feedback` → batch fixes → one commit/consolidated update → resolve → reviewDecision check → human re-review/dismissal ping if needed → role-gate approval via `squad_reviews_execute_pr_review`
**Branch Sync:** `squad_workflows_update_branch` (reactive — only when merge blocked by stale branch)
**Merge:** `squad_workflows_merge_check` → `squad_workflows_merge`
**Utility:** `squad_workflows_fast_lane`, `squad_workflows_board_sync`, `squad_workflows_wave_status`, `squad_workflows_status`

### Fast Lane
Issues labeled `estimate:S` or `squad:chore-auto` skip Design Proposal and Design Review.

### Wave-Based Delivery
Large features must be decomposed into waves (GitHub milestones). Each wave is independently shippable and produces a releasable changeset. Max issue estimate per wave: M.

### Branch Conventions
- Base branch: `dev`
- Branch naming: `squad/{issue-number}-{kebab-case-slug}`
- Always use worktrees: `git worktree add .worktrees/{slug} -b squad/{issue}-{slug} origin/dev`

### Pre-Push Validation
Before pushing any branch, run `npm test` (and `npm run build` if a build script exists in package.json). Do NOT push code that fails tests or build.

### Feedback Batching
When addressing PR review feedback, batch related unresolved threads for the same PR into one implementation pass, one validation run, one commit, and one consolidated PR comment/update where possible. Do not push one commit/comment per thread unless items are truly unrelated and cannot be safely batched. After all threads are resolved, check `reviewDecision`; if it remains `CHANGES_REQUESTED`, ping the human reviewer for re-review/dismissal, and submit required Squad role-gate approval separately with `squad_reviews_execute_pr_review`.
<!-- squad-workflows: end -->
