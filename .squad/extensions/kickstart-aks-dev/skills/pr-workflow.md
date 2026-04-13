# PR & Issue Workflow

**When to use:** You need to pick up an issue, create a branch, open a PR, navigate the review process, or merge work.

## Context

Kickstart uses a structured issue → DP → PR → review → merge lifecycle. Design discussion happens on the **issue** (via Design Proposals), not on the PR. PRs are for code review only.

## Steps

### 1. Pick Up an Issue

1. Assign to the current user:
   ```bash
   gh issue edit <N> --add-assignee "$(gh api user -q .login)"
   ```
2. Set the milestone to tie the issue to a release:
   ```bash
   gh issue edit <N> --milestone "<milestone-name>"
   ```
3. Update the project board status to **In progress** (use GraphQL — see Board Updates below).

### 2. Post a Design Proposal (DP)

Before writing any code, post a structured DP comment on the issue:

- Problem statement (reference the issue body)
- Proposed approach
- Files to modify / create
- Patterns and dependencies
- API contracts (if applicable)
- Security considerations
- Alternatives considered

Wait for **Leela** (architecture) and **Zapp** (security) to approve the DP before proceeding.

### 3. Create a Branch

```bash
git checkout -b squad/<issue-number>-<kebab-case-slug>
```

### 4. Open a Draft PR

Always open as draft — never open a ready PR directly:
```bash
gh pr create --draft \
  --title "<title>" \
  --body "Closes #<issue-number>

## Summary
<what changed>

## Changes
- <change 1>
- <change 2>

## Testing
<how tested>" \
  --head squad/<issue-number>-<slug> \
  --base main
```

### 5. Keep the Branch Current

When behind `main`, **always rebase** — never merge:
```bash
git fetch origin && git rebase origin/main
git push --force-with-lease
```

### 6. Mark Ready for Review

Only after work is complete AND CI passes:
```bash
gh pr ready <N>
```

### 7. Review Gates

Two gates must pass before merge:

1. **Leela** — code quality, architecture alignment with the approved DP
2. **Zapp** — security concerns (auth, injection, secrets, CORS)

Request Copilot review via REST API:
```bash
REPO_NWO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh api "repos/${REPO_NWO}/pulls/<N>/requested_reviewers" \
  --method POST -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
```

### 8. Address Feedback

- Check both formal reviews AND general comments
- Fix valid suggestions, reply with reasoning on disagreements
- **All threads must be resolved** before merging

### 9. Merge

```bash
gh pr merge <N> --squash --delete-branch
```

### 10. Board Updates

Move items through project board stages:

| Event | Status |
|-------|--------|
| Issue picked up | **In progress** |
| PR opened | **In review** |
| PR merged + issue closed | **Done** |

Use the GraphQL API to update project board fields. Cache field/option IDs in `.squad/config.json`.

## GitHub Account Selection

Before `gh` commands, ensure you're authenticated with the correct account. If the repo owner is a personal account (no `_` suffix), use your personal GitHub account. Run `gh auth status` to check.
