# PR & Issue Workflow

**When to use:** you are picking up an issue, opening a PR, navigating review, or merging.

## Context

Kickstart uses a structured issue → Design Proposal → PR → review → merge lifecycle. Design discussion happens on the **issue** (via a Design Proposal comment), not on the PR. PRs are for code review only.

## Write identity

For agent-authored GitHub writes, resolve the role app token first, stop the shell if resolution fails, and reuse it for every write:

```bash
TOKEN=$(node "$TEAM_ROOT/.squad/scripts/resolve-token.mjs" --required "$ROLE_SLUG") || exit 1
[ -n "$TOKEN" ] || exit 1
export GH_TOKEN="$TOKEN"
```

Normal agent writes in this repo do **not** use ambient `gh` auth.

## Steps

### 1. Pick up an issue

Do not auto-assign a human via the agent app token. If a human assignee is intentionally needed for visibility, do that as a separate explicit human-owned step outside the agent-authored write path.

```bash
GH_TOKEN=$TOKEN gh issue edit <N> --milestone "<milestone-name>"
```

Move the project board status to **In progress**.

### 2. Post a Design Proposal (DP)

Before writing code, confirm the issue carries exactly one `estimate:S`, `estimate:M`, `estimate:L`, or `estimate:XL` label, then post a DP comment on the issue with:

- Problem statement (reference the issue body)
- `Estimate: <S/M/L/XL>` (required; must match the issue label. Calibration: S≈2h/1 point, M≈8h/3 points, L≈24h/8 points, XL≈80h/20 points)
- Proposed approach (reference the relevant section of `docs-site/docs/architecture/v2-implementation-brief.md`)
- Files to modify or create
- Pack boundaries affected (which pack owns which change)
- Tool / user-action / component surface changes
- Security considerations (tool schema changes, trust boundaries)
- Docs and changeset plan
- Alternatives considered

Wait for **Leela** (architecture) and **Zapp** (security) to approve the DP. Do not start coding before. Leela rejects a DP that is missing `Estimate:` or does not match the issue's `estimate:*` label.

### 3. Create a worktree (required)

**Always use a worktree.** The shared top-level checkout is for reading and coordination. Agents that `git checkout -b` in the main working tree clobber each other's uncommitted work and produce dirty issues: wrong branch base, mixed diffs, orphaned files.

From the repo root:

```bash
git fetch origin
git worktree list                                      # reuse if yours exists
git worktree add .worktrees/<slug-or-issue-number> \
  -b squad/<issue-number>-<kebab-case-slug> \
  origin/main
cd .worktrees/<slug-or-issue-number>
```

### 4. Open a draft PR

Always draft, never ready on first push.

```bash
GH_TOKEN=$TOKEN gh pr create --draft \
  --title "<title>" \
  --body "Closes #<issue-number>

## Summary
<what the user gains or loses>

## Changes
- <change 1>
- <change 2>

## Testing
<how tested>

## Docs and changeset
- [ ] Changeset added (or marked internal-only with reason)
- [ ] docs-site/docs/ updated (or N/A)
- [ ] docs-site/docs/architecture/v2-implementation-brief.md updated (or N/A)
- [ ] docs-site/docs/extending/api-endpoints.md updated (or N/A)
- [ ] Pack docs updated (or N/A)
- [ ] Tests added or covered
" \
  --head squad/<issue-number>-<slug> \
  --base main
```

### 5. Keep the branch current

Rebase, never merge. Push with the app token, not ambient auth.

```bash
git fetch origin && git rebase origin/main
git push https://x-access-token:${TOKEN}@github.com/<owner>/<repo>.git squad/<issue-number>-<slug> --force-with-lease
```

### 6. Mark ready for review

Only after:
- All CI checks are green.
- Pre-merge checklist is complete.
- Docs and changeset are in place.

```bash
GH_TOKEN=$TOKEN gh pr ready <N>
```

### 7. Review gates

| Reviewer | Checks |
|----------|--------|
| Leela | Architecture alignment, scope, code quality, DP match |
| Zapp | Security, auth, secrets, tool schemas, guardrails |
| Nibbler | Code quality, maintainability, test coverage depth |
| Docs reviewer | User-facing docs updated (or DP declared `Docs impact: N/A`) |
| Hermes | Test coverage across the layers the PR touches (separate from Nibbler's code-quality pass) |

Leela, Zapp, and Nibbler must all approve. The docs gate is satisfied by **one of** `docs:approved` or `docs:not-applicable`; `docs:rejected` fails the gate. The `.github/workflows/squad-review-gate.yml` workflow enforces this as a required status check and `.github/workflows/squad-auto-merge.yml` arms auto-merge once all four dimensions are satisfied.

`Squad Auto Merge` clears the three approval labels (`leela:approved`, `zapp:approved`, `nibbler:approved`) on every `synchronize`. If exactly one reviewer is in a rejection loop, the other two approvals are preserved across the synchronize — so a `zapp:rejected` fix cycle preserves `leela:approved` + `nibbler:approved`, a `leela:rejected` fix cycle preserves `zapp:approved` + `nibbler:approved`, and a `nibbler:rejected` fix cycle preserves `leela:approved` + `zapp:approved`. Docs labels persist across synchronize (they describe the PR content, not a per-commit signoff).

For `squad:chore-auto` low-risk PRs, Nibbler still gates (code-quality review is cheap) and the docs marker is still required. Zapp becomes optional unless the PR is security-sensitive or touches `.github/workflows/**`, auth, guardrail, or security code.

### 8. Address review comments

Before you start addressing individual review comments, post a comment acknowledging the feedback and that you will respond.

For every comment (Copilot, Leela, Zapp, any reviewer):

1. Fix the code, or decide not to and explain why.
2. Reply to the specific comment with `Addressed in {sha}: {description}`.
3. Resolve the thread via the GraphQL `resolveReviewThread` mutation.
4. Confirm zero unresolved threads before merging.

Never silently fix and move on.

### 9. Merge

- Squash merge.
- Delete the branch.
- Verify the issue auto-closes via `Closes #N`.
- Move the project board card to **Done**.

## Copilot Coding Agent

When @copilot picks up an issue autonomously:

- It checks its capability tier in `.squad/team.md` before starting.
- 🟢 Good fit: proceeds and opens a PR.
- 🟡 Needs review: proceeds but flags in the PR body.
- 🔴 Not suitable: refuses and asks for reassignment.

Copilot still follows this workflow: DP on the issue, draft PR, docs and changeset, respond to every comment. No shortcuts.
