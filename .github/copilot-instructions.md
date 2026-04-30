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
- [ ] **Design Proposal posted.** A DP comment has been posted on the issue by the implementing agent, containing: problem statement, proposed approach, `Estimate:` field, files to modify, pack boundaries, security considerations, docs and changeset plan, alternatives considered. Fast-lane exemption: skip DP only if the issue is labeled `estimate:S` OR `squad:chore-auto`.
- [ ] **Design Review approved.** The DP comment has all three approval labels present on the issue: `architecture:approved`, `security:approved`, `codereview:approved`. Fast-lane exemption: skip DR only if `estimate:S` OR `squad:chore-auto`.

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

## Branch Naming

Use the squad branch convention:
```
squad/{issue-number}-{kebab-case-slug}
```
Example: `squad/42-fix-login-validation`

## Worktrees

Never run `git checkout -b` in the top-level working tree. Every piece of issue work happens inside its own worktree under `.worktrees/`. This prevents agents from stomping on each other's uncommitted changes, branching off the wrong base, or producing mixed-diff PRs.

Before starting work:

```bash
git fetch origin
git worktree list                    # see what's already in flight; reuse if yours exists
git worktree add .worktrees/<issue-number-or-slug> \
  -b squad/<issue-number>-<slug> origin/main
cd .worktrees/<issue-number-or-slug>
```

All subsequent edits, commits, and `gh pr create` calls run from inside the worktree. After the PR merges or closes, run `git worktree remove .worktrees/<name> && git worktree prune` from another checkout.

If you find yourself about to branch from `main` in the top-level checkout, stop and create a worktree instead.

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

The full protocol with API commands is in `.squad/skills/pr-workflow/SKILL.md` under **Handling Review Feedback**.

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
