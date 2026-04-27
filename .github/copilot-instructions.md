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

## Bot Identity — all GitHub writes

This repo has a per-role GitHub App identity configured. Every agent-authored GitHub write (PR create, issue comment, label, review) MUST use the bot token, not ambient `gh` auth.

**Before any `gh` or `git push` command that writes to GitHub:**

```bash
# 1. Isolate gh auth — prevents silent fallback to the human operator's auth
unset GH_TOKEN GITHUB_TOKEN
export GH_CONFIG_DIR="$(git rev-parse --show-toplevel)/.squad/runtime/gh-config/$$"
mkdir -p "$GH_CONFIG_DIR"

# 2. Resolve the role token — fails closed if no app is configured
ROLE_SLUG="<your-role-slug>"   # lead | frontend | backend | tester | security | codereview | devops | docs
TOKEN=$(node "$(git rev-parse --show-toplevel)/.squad/scripts/resolve-token.mjs" --required "$ROLE_SLUG") || exit 1
[ -n "$TOKEN" ] || exit 1
```

Role slug mapping: Leela → `lead`, Fry → `frontend`, Bender → `backend`, Hermes → `tester`, Zapp → `security`, Nibbler → `codereview`, Kif → `devops`, Amy → `docs`. The Copilot coding agent acting as a squad member uses the role slug of that member.

**Use the token inline — never `export GH_TOKEN`:**

```bash
git push "https://x-access-token:${TOKEN}@github.com/{owner}/{repo}.git" HEAD
GH_TOKEN="$TOKEN" gh pr create --draft --title "..." --body "..."
GH_TOKEN="$TOKEN" gh issue comment <N> --body "..."
```

**PR body must include:** `🤖 Created by [squad-{role}](https://github.com/apps/squad-{role})`

**Never echo the token.** No `echo "$TOKEN"`, no `env`, no `printenv` near token-handling blocks.

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
