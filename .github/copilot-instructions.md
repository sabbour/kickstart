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

When addressing any review comment (from Copilot, Leela, Zapp, Nibbler, or any reviewer):
1. Fix the code (or decide not to and explain why)
2. Reply to the specific comment with what you did: "Addressed in {sha}: {description}"
3. Resolve the thread via GitHub GraphQL API (resolveReviewThread mutation)
4. Verify 0 unresolved threads before attempting merge

Never silently fix and move on. A reply is required on every comment.

The full protocol is defined in `.squad/ceremonies.md` under the **PR Review Gate** section.

## Decisions

If you make a decision that affects other team members, write it to:
```
.squad/decisions/inbox/copilot-{brief-slug}.md
```
The Scribe will merge it into the shared decisions file.
