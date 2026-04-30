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

## Pre-Dispatch Checkpoint — MUST complete before writing any code

**These checks are non-negotiable. Writing code before they pass is a governance violation.**

Before touching a single source file, verify all three boxes:

- [ ] **Issue exists.** The work is tied to a GitHub issue number. If no issue exists, stop and create one before proceeding.
- [ ] **Design Proposal posted.** Use `squad_workflows_post_design_proposal` to post the DP. Fast-lane exemption: skip DP only if the issue is labeled `estimate:S` OR `squad:chore-auto` (check with `squad_workflows_fast_lane`).
- [ ] **Design Review approved.** Use `squad_workflows_check_design_approval` to verify all approval labels are present. Fast-lane exemption: same as above.

If any box is unchecked → run the missing ceremony first. Do not proceed to code.

## Changeset Requirement — every code-producing PR

The agent writing the code is responsible for including a changeset in the same PR branch. This is not Amy's job. This is not Scribe's job.

**Before opening a PR, from inside the worktree:**

```bash
npm run changeset
```

- Select affected packages.
- Pick bump type: `patch` for fixes, `minor` for new behaviour, `major` for breaking changes.
- Write the changeset body in the user's voice — what the user gains or loses, not what files changed.

**Exceptions** (no changeset needed, but state this explicitly in the PR body):
- `estimate:S` internal-only changes (refactor, test-only, dev tooling with no user-visible effect)
- Docs-only changes

Changeset is committed and pushed as part of the PR branch. Do not open the PR without it (unless explicitly exempt).

Amy will review the changeset quality during the PR Review Gate. Scribe curates CHANGELOG entries from aggregated changesets at release time. Neither of them writes the changeset — you do.

## PR Guidelines

When opening a PR:
- Reference the issue: `Closes #{issue-number}`
- If the issue had a `squad:{member}` label, mention the member: `Working as {member} ({role})`
- If this is a 🟡 needs-review task, add to the PR description: `⚠️ This task was flagged as "needs review" — please have a squad member review before merging.`
- Follow any project conventions in `.squad/decisions.md`

## PR Review Feedback — Required Loop

Review sources that MUST be acknowledged (all carry equal weight):
- Squad reviewers: Leela, Zapp, Nibbler, Amy
- GitHub Copilot PR review bot (`copilot-pull-request-reviewer[bot]`)
- Human reviewers

**Strict order — no exceptions:**
1. Fix the code (or decide not to and explain why)
2. **Post a reply** to the specific comment: `"Addressed in {sha}: {description}"` or `"Dismissed: {justification}"`
3. **Only after the reply is posted** — resolve the thread via `resolveReviewThread` GraphQL mutation
4. Verify 0 unresolved threads before attempting merge

**❌ FORBIDDEN: Resolving a thread without first posting a reply.**
Silently marking a thread resolved — even after fixing the code — is a protocol violation. The reply is what proves the feedback was considered. Fix + reply + resolve is the indivisible unit.

The full protocol is documented in `.squad/ceremonies.md` under **PR Review Gate**.

## Decisions

If you make a decision that affects other team members, write it to:
```
.squad/decisions/inbox/copilot-{brief-slug}.md
```
The Scribe will merge it into the shared decisions file.

<!-- squad-identity: start -->
## GIT IDENTITY — Bot Authentication

This project uses GitHub App bot identity for all agent-authored writes.
Read `.squad/skills/squad-identity/SKILL.md` before any GitHub write.

**Use the `squad_identity_resolve_token` tool** to get a bot token for your ROLE_SLUG.

Your ROLE_SLUG is injected into your charter — look for:
```
ROLE_SLUG="<slug>"  # injected by configure-identity --update-charters
```

If absent, call `squad_identity_status` to see the full agentNameMap.

**Token usage (inline per-call, never export):**
```bash
GH_TOKEN="$TOKEN" gh pr create ...
GH_TOKEN="$TOKEN" gh api /repos/{owner}/{repo}/issues -f title="..." 
git push "https://x-access-token:${TOKEN}@github.com/{owner}/{repo}.git" HEAD
```
<!-- squad-identity: end -->

<!-- squad-workflows: start -->
## Workflow Tools (squad-workflows extension)

Use these tools for the issue-to-merge lifecycle:

**Planning:** `squad_workflows_estimate` → `squad_workflows_decompose` (if L/XL)
**Design:** `squad_workflows_post_design_proposal` → `squad_workflows_check_design_approval`
**Review:** `squad_workflows_check_feedback` + `squad_workflows_check_ci`
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
<!-- squad-workflows: end -->
