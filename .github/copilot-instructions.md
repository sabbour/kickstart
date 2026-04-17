# Copilot Coding Agent — Squad Instructions

You are working on a project that uses **Squad**, an AI team framework. When picking up issues autonomously, follow these guidelines.

## Team Context

Before starting work on any issue, PR, comment, or workflow-driven task:

1. Read `.squad/team.md` for the team roster, member roles, and your capability profile.
2. Read `.squad/routing.md` for work routing rules.
3. **Adopt the named persona.** The persona is signalled in priority order:
   1. An explicit instruction in the comment or issue body like `work as Scribe` or `Working as Leela (Lead)`.
   2. A `squad:{member}` label on the issue or PR.
   3. The `squad:{member}` label on the parent issue linked from a PR.

   Once the persona is known, read `.squad/agents/{member}/charter.md` and work in that voice. Match their boundaries, model preferences, and style. Do not default to generic Copilot behaviour when a persona is specified.
4. Read `.squad/ceremonies.md` if the task came from an automated workflow (daily pulse, weekly pulse, release cadence, PR retro) so you understand what artifact the workflow expects.
5. If no persona is specified **and** the task clearly belongs to one (e.g. release notes → Scribe, architecture review → Leela, security review → Zapp), adopt that persona and state it in your first reply.

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

## Worktrees are mandatory

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

When addressing any review comment (from Copilot, Leela, Zapp, or any reviewer):
1. Fix the code (or decide not to and explain why)
2. Reply to the specific comment with what you did: "Addressed in {sha}: {description}"
3. Resolve the thread via GitHub GraphQL API (resolveReviewThread mutation)
4. Verify 0 unresolved threads before attempting merge

Never silently fix and move on. A reply is required on every comment.

## Decisions

If you make a decision that affects other team members, write it to:
```
.squad/decisions/inbox/copilot-{brief-slug}.md
```
The Scribe will merge it into the shared decisions file.
