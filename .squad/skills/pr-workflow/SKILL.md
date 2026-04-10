# PR & Issue Workflow

> Single reference for the full issue → branch → PR → review → merge lifecycle on this project.

## SCOPE

✅ THIS SKILL COVERS:
- Issue assignment and tracking
- PR creation, review, and merge process
- Project board status updates
- Sprint cycle management
- Model preference

❌ THIS SKILL DOES NOT COVER:
- Code implementation details
- Test strategy (see Hermes's charter)
- Architecture decisions (see Leela's charter)

---

## GitHub Account Selection

Before running any `gh` commands, ensure you are authenticated with the correct GitHub account.

1. **Determine the repo owner** from the git remote:
   ```bash
   REPO_OWNER=$(gh repo view --json owner -q .owner.login)
   ```

2. **Check if this is a personal (non-EMU) repo.** EMU accounts typically have an `_` suffix (e.g., `user_microsoft`). If the repo owner is a personal account, switch `gh` to the personal account:
   ```bash
   # List authenticated accounts
   gh auth status
   # If the active account is an EMU account and the repo owner is personal, switch:
   gh auth switch  # interactive — pick the matching account
   ```

3. **Verify** the active account matches the repo context:
   ```bash
   gh api user -q .login
   ```

> **Rule of thumb:** if `REPO_OWNER` does NOT contain `_` (i.e., it's not an EMU slug), use your personal GitHub account. Otherwise, use the EMU account.

---

## Issue Workflow

### Picking Up an Issue

1. **Assign to the current user** so the human owner has visibility:
   ```bash
   gh issue edit <N> --add-assignee "$(gh api user -q .login)"
   ```

2. **Post major findings as comments** on the issue as work progresses:
   ```bash
   gh issue comment <N> --body "🔍 Finding: ..."
   ```

3. **Set the milestone** on the issue to tie it to the current sprint/release:
   ```bash
   gh issue edit <N> --milestone "<milestone-name>"
   ```

4. **Update project board fields** (Priority, Size, Estimate, Status).

   The project board URL is in `.squad/team.md` under `## Issue Source`. Extract the project number from it.

   Use the GitHub GraphQL API to update fields. First, discover field IDs:
   ```bash
   REPO_OWNER=$(gh repo view --json owner -q .owner.login)
   PROJECT_NUM=$(grep -oP 'projects/\K[0-9]+' .squad/team.md)
   gh api graphql -f query='
     query {
       user(login: "'"$REPO_OWNER"'") {
         projectV2(number: '"$PROJECT_NUM"') {
           id
           fields(first: 20) {
             nodes {
               ... on ProjectV2Field { id name }
               ... on ProjectV2SingleSelectField { id name options { id name } }
               ... on ProjectV2IterationField { id name }
             }
           }
         }
       }
     }'
   ```

   Then update a field on an item:
   ```bash
   gh api graphql -f query='
     mutation {
       updateProjectV2ItemFieldValue(input: {
         projectId: "<PROJECT_ID>"
         itemId: "<ITEM_ID>"
         fieldId: "<FIELD_ID>"
         value: { singleSelectOptionId: "<OPTION_ID>" }
       }) { projectV2Item { id } }
     }'
   ```

   Cache discovered field/option IDs in `.squad/config.json` under `projectBoard` to avoid repeated lookups.

---

## PR Workflow

### Creating a PR

1. **Always open as draft** — never open a ready PR directly:
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

2. **Post findings as PR comments** as work progresses:
   ```bash
   gh pr comment <N> --body "📝 Progress: ..."
   ```

### Keeping the Branch Current

When the branch is behind `main`, **always rebase** — never merge:
```bash
git fetch origin
git rebase origin/main
# Resolve any conflicts
git push --force-with-lease
```

### Marking Ready for Review

Only after work is complete AND CI passes:
```bash
gh pr ready <N>
```

### Requesting Copilot Review

Use the REST API (not comment mentions):
```bash
REPO_NWO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh api "repos/${REPO_NWO}/pulls/<N>/requested_reviewers" \
  --method POST \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
```

### Handling Review Feedback

1. **Check both formal reviews AND general comments** — @copilot may respond in either format:
   ```bash
   gh pr view <N> --json reviews
   gh pr view <N> --json comments
   ```

2. **Address each review comment:**
   - Fix valid suggestions — commit the fix
   - Reply with reasoning on items you disagree with
   - Resolve each review thread after addressing it

3. **All threads must be resolved** before merging.

### CI Requirements

All CI checks must pass, including Playwright E2E tests. If checks fail:
1. Spawn the owning agent to fix failures
2. Keep iterating until CI is green
3. Do NOT merge PRs with failing required checks

### Merging

Once all reviews are addressed, threads resolved, and CI is green:
```bash
gh pr merge <N> --squash --delete-branch
```

---

## Board Status Updates

Move items through the project board as work progresses:

| Event | Board Status |
|-------|-------------|
| New issue created | **Backlog** |
| Issue picked up (branch created) | **In progress** |
| PR opened | **In review** |
| PR merged + issue closed | **Done** |

Use the GraphQL mutation from the "Update project board fields" section above to set the Status field.

---

## Sprint Cycle

Ralph runs continuous sprints:

1. **Execute** — Work through the current milestone's issues
2. **Retro** — Run Sprint Retro ceremony after milestone PRs are merged
3. **Plan** — Run Sprint Planning for the next milestone
4. **Repeat** — Continue until all milestones are complete

Each milestone = one sprint/release.

---

## Model Preference

Default model for all agents: `claude-opus-4.6` (configured in `.squad/config.json`).

See `.squad/skills/model-selection/SKILL.md` for the full model resolution hierarchy.

---

## Branch Naming

Issue branches: `squad/{issue-number}-{kebab-case-slug}`

Example: `squad/42-fix-login-validation`

---

## Quick Reference Checklist

```
□ Assign issue to current user (gh api user -q .login)
□ Set milestone
□ Update board → In progress
□ Create branch: squad/{N}-{slug}
□ Open draft PR: gh pr create --draft
□ Post progress comments on PR
□ Rebase if behind main (never merge)
□ All CI green
□ gh pr ready
□ Request @copilot review via API
□ Address all review comments
□ Resolve all threads
□ Update board → In review
□ gh pr merge --squash --delete-branch
□ Update board → Done
```
