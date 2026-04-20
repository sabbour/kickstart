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

## Design Proposal (DP) Process

> Design discussion happens on the **issue**, not the PR. PRs are for code review only.

### Authorship

- **Issue body** (problem + acceptance criteria) = written by Ahmed or Leela during triage. This is the "what and why."
- **DP comment** (proposed approach) = written by the implementing agent (Bender/Fry/Hermes). This is the "how."
- Agents do NOT write problem statements — they propose solutions to problems defined by the product owner or Lead.

### DP Lifecycle

1. **Issue is triaged** — Ahmed or Leela writes the problem statement and acceptance criteria in the issue body.
2. **Agent picks up issue** — posts a **Design Proposal (DP)** as a structured comment on the issue BEFORE writing any code.
3. **DP structure:**
   - Problem statement (reference to issue body)
   - Proposed approach
   - Files to modify / create
   - Patterns and dependencies
   - API contracts (if applicable)
   - Security considerations
   - Alternatives considered
4. **Leela reviews DP** for architecture quality (comment on issue).
5. **Zapp reviews DP** for security concerns (comment on issue).
6. **Both approve** → agent proceeds to implementation.
7. **Draft PR opened** — code review only; design is already approved on the issue.
8. **PR marked ready** → CI → Leela reviews code quality → Zapp reviews security → merge.

> For foundational patterns (e.g., ServiceConnector, ServicePack, LLM tool system), the DP may reference a full design doc in `docs/architecture/`.

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

### Review Gates

Before a PR can merge, it must pass two review gates:

1. **Leela** — reviews for code quality, architecture alignment with the approved DP
2. **Zapp** — reviews for security concerns (auth, injection, secrets, CORS)

Zapp's review is a **pre-merge gate** for foundational patterns. Do not merge without Zapp's approval on security-sensitive changes.

**How approvals work (label-based):**
- **Leela** approves by adding the `leela:approved` label:
  ```bash
  gh pr edit {number} --add-label "leela:approved" --repo sabbour/kickstart
  ```
- **Zapp** approves by adding the `zapp:approved` label:
  ```bash
  gh pr edit {number} --add-label "zapp:approved" --repo sabbour/kickstart
  ```

No GitHub formal PR review approval is required — squad agents share a single GitHub account with the repo owner, making self-approval impossible. The `squad/review-gate` status check (`.github/workflows/squad-review-gate.yml`) automatically turns green when both labels are present.

### Requesting Copilot Review

Use the REST API (not comment mentions):
```bash
REPO_NWO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh api "repos/${REPO_NWO}/pulls/<N>/requested_reviewers" \
  --method POST \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
```

### Handling Review Feedback

When a PR has review comments or formal review threads, the full feedback loop is:

1. **Read ALL feedback** — check both formal review threads AND top-level comments:
   ```bash
   # Formal review threads (these must all be resolved before merge)
   gh pr view <N> --json reviewThreads --jq '.reviewThreads[] | {id: .id, isResolved: .isResolved, path: .path, body: (.comments[0].body // ""), line: .line}'
   
   # Top-level PR comments (Copilot often posts here)
   gh pr view <N> --json comments --jq '.comments[] | {id: .id, author: .author.login, body: .body}'
   
   # Formal review decisions
   gh pr view <N> --json reviews --jq '.reviews[] | {author: .author.login, state: .state, body: .body}'
   ```

2. **For each piece of feedback, decide:**
   - Valid → fix it
   - Disagree → explain why in a reply

3. **After fixing (or deciding not to fix), ALWAYS reply to the specific comment:**
   ```bash
   # Reply to a review thread comment (get comment ID from reviewThreads query above)
   gh api "repos/sabbour/kickstart/pulls/<PR>/comments/<comment_id>/replies" \
     --method POST \
     -f body="Addressed in <commit_sha>: <what you changed and why, 1-2 sentences>. Resolving thread."
   
   # OR for a top-level PR comment, reply inline:
   gh pr comment <N> --body "Re: <quote the feedback briefly> — <what you did to address it, or why not>."
   ```

4. **Resolve the thread after replying:**
   ```bash
   # Get thread node ID
   THREAD_ID=$(gh api graphql -f query='{
     repository(owner: "sabbour", name: "kickstart") {
       pullRequest(number: <N>) {
         reviewThreads(first: 50) {
           nodes { id isResolved path line comments(first:1) { nodes { body } } }
         }
       }
     }
   }' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | .id')
   
   # Resolve it
   gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "<THREAD_ID>"}) { thread { isResolved } } }'
   ```

5. **Verify all threads are resolved before attempting merge:**
   ```bash
   UNRESOLVED=$(gh pr view <N> --json reviewThreads --jq '[.reviewThreads[] | select(.isResolved == false)] | length')
   # Must be 0 before proceeding
   ```

**NEVER silently fix code and move on.** A reply is required for every piece of feedback, even if the fix is trivial. This is not optional.

**Why this matters:** `require_conversation_resolution: true` is enforced in branch protection. Unresolved threads block the `squad/review-gate` status check. Even if both `leela:approved` and `zapp:approved` labels are present, GitHub will not allow merge while threads are open.

### CI Requirements

All CI checks must pass, including Playwright E2E tests. If checks fail:
1. Spawn the owning agent to fix failures
2. Keep iterating until CI is green
3. Do NOT merge PRs with failing required checks

### Merge Gate

**Rule:** Never call `gh pr merge` without first verifying ALL of the following:

1. **Squad label gate** — both approval labels must be present:
   ```bash
   gh pr view {number} --json labels --jq '[.labels[].name] | contains(["leela:approved", "zapp:approved"])'
   ```
   Must return `true`.

2. **Conversation resolution** — all review threads resolved:
   ```bash
   gh pr view {number} --json reviewThreads --jq '[.reviewThreads[] | select(.isResolved == false)] | length'
   ```
   Must return `0`.

If either check fails — STOP. Do not merge. Comment on the PR requesting review from Leela or Zapp.

**NEVER use `--admin` flag.** Branch protection exists to enforce review. Bypassing it with `--admin` defeats the entire gate. If protection blocks a merge, that is correct behavior — request review, do not force.

**Why this exists:** Squad agents push PRs under the same GitHub user account as the repo owner. Authors cannot approve their own PRs in GitHub, so the "1 required approving review" gate permanently blocked every squad PR. The label-based gate replaces that with a status check that squad agents can satisfy.

### Merging

Once merge gate checks pass, all reviews are addressed, threads resolved, and CI is green:
```bash
gh pr merge <N> --squash --delete-branch
```

Qualifying GitHub PRs can now skip the manual merge command: the `Squad Auto Merge` workflow arms squash auto-merge when `leela:approved` + `zapp:approved` are both present, all checks are green, and the PR is neither XL (>1000 changed lines) nor titled `refactor`.

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
□ Post Design Proposal (DP) comment on issue
□ Leela approves DP (architecture)
□ Zapp approves DP (security)
□ Create branch: squad/{N}-{slug}
□ Implement (design already approved)
□ Open draft PR: gh pr create --draft
□ Post progress comments on PR
□ Rebase if behind main (never merge)
□ All CI green
□ gh pr ready
□ Request @copilot review via API
□ Leela reviews code quality
□ Zapp reviews security
□ Address all review comments
□ Resolve all threads
□ Update board → In review
□ gh pr merge --squash --delete-branch
□ Update board → Done
```
