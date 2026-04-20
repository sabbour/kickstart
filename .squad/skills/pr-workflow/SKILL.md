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

## GitHub Write Identity

For agent-authored GitHub writes in this repo, do **not** rely on ambient `gh` auth. Resolve the explicit app token once per shell, stop immediately if resolution fails, and reuse it for every write command:

```bash
TOKEN=$(node "$TEAM_ROOT/.squad/scripts/resolve-token.mjs" --required "$ROLE_SLUG") || exit 1
[ -n "$TOKEN" ] || exit 1
export GH_TOKEN="$TOKEN"
```

- `TEAM_ROOT` and `ROLE_SLUG` come from the coordinator prompt.
- `--required` must be paired with `|| exit 1` (plus `[ -n "$TOKEN" ] || exit 1`) so the shell also fails closed when token resolution breaks.
- Read-only `gh` commands can still use normal auth, but issue/PR comments, edits, GraphQL mutations, pushes, and PR creation must use `GH_TOKEN=$TOKEN` or token-authenticated HTTPS.

---

## Issue Workflow

### Picking Up an Issue

1. **Do not auto-assign a human via the agent app token.** If a human assignee is intentionally needed for visibility, do that as a separate explicit human-owned step outside the agent-authored write path.

2. **Post major findings as comments** on the issue as work progresses:
   ```bash
   GH_TOKEN=$TOKEN gh issue comment <N> --body "🔍 Finding: ..."
   ```

3. **Set the milestone** on the issue to tie it to the current sprint/release:
   ```bash
   GH_TOKEN=$TOKEN gh issue edit <N> --milestone "<milestone-name>"
   ```

4. **Update project board fields** (Priority, Size, Estimate, Status).

   The project board URL is in `.squad/team.md` under `## Issue Source`. Extract the project number from it.

   Use the GitHub GraphQL API to update fields. First, discover field IDs:
   ```bash
   REPO_OWNER=$(gh repo view --json owner -q .owner.login)
   PROJECT_NUM=$(grep -oP 'projects/\K[0-9]+' .squad/team.md)
   GH_TOKEN=$TOKEN gh api graphql -f query='
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
   GH_TOKEN=$TOKEN gh api graphql -f query='
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
2. **Agent picks up issue** — confirms the issue has exactly one `estimate:S`, `estimate:M`, `estimate:L`, or `estimate:XL` label, then posts a **Design Proposal (DP)** as a structured comment on the issue BEFORE writing any code.
3. **DP structure:**
   - Problem statement (reference to issue body)
   - `Estimate: <S/M/L/XL>` (required; must match the issue label. Calibration: S≈2h/1 point, M≈8h/3 points, L≈24h/8 points, XL≈80h/20 points)
   - Proposed approach
   - Files to modify / create
   - Patterns and dependencies
   - API contracts (if applicable)
   - Security considerations
   - Alternatives considered
4. **Leela reviews DP** for architecture quality (comment on issue). A DP missing `Estimate:` or mismatching the issue's `estimate:*` label is rejected.
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
   GH_TOKEN=$TOKEN gh pr create --draft \
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
   GH_TOKEN=$TOKEN gh pr comment <N> --body "📝 Progress: ..."
   ```

### Keeping the Branch Current

When the branch is behind `main`, **always rebase** — never merge:
```bash
git fetch origin
git rebase origin/main
# Resolve any conflicts
git push https://x-access-token:${TOKEN}@github.com/sabbour/kickstart.git squad/<issue-number>-<slug> --force-with-lease
```

### Marking Ready for Review

Only after work is complete AND CI passes:
```bash
GH_TOKEN=$TOKEN gh pr ready <N>
```

### Review Gates

Before a PR can merge, it must pass two review gates:

1. **Leela** — reviews for code quality, architecture alignment with the approved DP
2. **Zapp** — reviews for security concerns (auth, injection, secrets, CORS)

Zapp's review is a **pre-merge gate** for foundational patterns. Do not merge without Zapp's approval on security-sensitive changes.

**How approvals work (label-based):**
- **Leela** approves by adding the `leela:approved` label:
  ```bash
  GH_TOKEN=$TOKEN gh pr edit {number} --add-label "leela:approved" --repo sabbour/kickstart
  ```
- **Zapp** approves by adding the `zapp:approved` label:
  ```bash
  GH_TOKEN=$TOKEN gh pr edit {number} --add-label "zapp:approved" --repo sabbour/kickstart
  ```

No GitHub formal PR review approval is required — squad agents share a single GitHub account with the repo owner, making self-approval impossible. The `squad/review-gate` status check (`.github/workflows/squad-review-gate.yml`) normally turns green when both labels are present. For explicitly low-risk PRs labeled `squad:chore-auto`, the gate accepts `leela:approved` alone unless the PR looks security-sensitive (`security`, `GHSA`, `CVE`, `vulnerability`) or touches sensitive paths (`.github/workflows/**`, auth, guardrail, security code), in which case `zapp:approved` is still required. `Squad Auto Merge` clears approval labels on every `synchronize` so new commits always need fresh approval labels.

### Requesting Copilot Review

Use the REST API (not comment mentions):
```bash
REPO_NWO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
GH_TOKEN=$TOKEN gh api "repos/${REPO_NWO}/pulls/<N>/requested_reviewers" \
  --method POST \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
```

### Handling Review Feedback

When a PR has review comments or formal review threads, the full feedback loop is:

1. **Read ALL feedback** — check both formal review threads AND top-level comments:
   ```bash
   # Formal review threads (these must all be resolved before merge)
   GH_TOKEN=$TOKEN gh pr view <N> --json reviewThreads --jq '.reviewThreads[] | {id: .id, isResolved: .isResolved, path: .path, body: (.comments[0].body // ""), line: .line}'
   
   # Top-level PR comments (Copilot often posts here)
   GH_TOKEN=$TOKEN gh pr view <N> --json comments --jq '.comments[] | {id: .id, author: .author.login, body: .body}'
   
   # Formal review decisions
   GH_TOKEN=$TOKEN gh pr view <N> --json reviews --jq '.reviews[] | {author: .author.login, state: .state, body: .body}'
   ```

2. **For each piece of feedback, decide:**
   - Valid → fix it
   - Disagree → explain why in a reply

3. **After fixing (or deciding not to fix), ALWAYS reply to the specific comment:**
   ```bash
   # Reply to a review thread comment (get comment ID from reviewThreads query above)
   GH_TOKEN=$TOKEN gh api "repos/sabbour/kickstart/pulls/<PR>/comments/<comment_id>/replies" \
     --method POST \
     -f body="Addressed in <commit_sha>: <what you changed and why, 1-2 sentences>. Resolving thread."
   
   # OR for a top-level PR comment, reply inline:
   GH_TOKEN=$TOKEN gh pr comment <N> --body "Re: <quote the feedback briefly> — <what you did to address it, or why not>."
   ```

4. **Resolve the thread after replying:**
   ```bash
   # Get thread node ID
   THREAD_ID=$(GH_TOKEN=$TOKEN gh api graphql -f query='{
     repository(owner: "sabbour", name: "kickstart") {
       pullRequest(number: <N>) {
         reviewThreads(first: 50) {
           nodes { id isResolved path line comments(first:1) { nodes { body } } }
         }
       }
     }
   }' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | .id')
   
   # Resolve it
   GH_TOKEN=$TOKEN gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "<THREAD_ID>"}) { thread { isResolved } } }'
   ```

5. **Verify all threads are resolved before attempting merge:**
   ```bash
   UNRESOLVED=$(GH_TOKEN=$TOKEN gh pr view <N> --json reviewThreads --jq '[.reviewThreads[] | select(.isResolved == false)] | length')
   # Must be 0 before proceeding
   ```

**NEVER silently fix code and move on.** A reply is required for every piece of feedback, even if the fix is trivial. This is not optional.

**Why this matters:** `require_conversation_resolution: true` is enforced in branch protection. Unresolved threads block the `squad/review-gate` status check. Even if the required label set for the PR is present (`leela:approved` + `zapp:approved`, or the low-risk `squad:chore-auto` path), GitHub will not allow merge while threads are open.

### CI Requirements

All CI checks must pass, including Playwright E2E tests. If checks fail:
1. Spawn the owning agent to fix failures
2. Keep iterating until CI is green
3. Do NOT merge PRs with failing required checks

### Merge Gate

**Rule:** Never call `GH_TOKEN=$TOKEN gh pr merge` without first verifying ALL of the following:

1. **Squad label gate** — verify the PR satisfies one of the allowed approval paths on the current head:
    - standard path: `leela:approved` + `zapp:approved`
    - low-risk path: `squad:chore-auto` + `leela:approved`
    - low-risk sensitive path: `squad:chore-auto` + `leela:approved` + `zapp:approved` when the PR text looks security-sensitive or it touches `.github/workflows/**`, auth, guardrail, or security code

    ```bash
    PR_JSON=$(GH_TOKEN=$TOKEN gh pr view {number} --json number,title,body,headRefName,labels)
    FILES_JSON=$(GH_TOKEN=$TOKEN gh api repos/sabbour/kickstart/pulls/{number}/files --paginate)
    jq -n --argjson pr "$PR_JSON" --argjson files "$FILES_JSON" '
      ($pr.labels | map(.name)) as $labels
      | ([ $pr.title, $pr.body, $pr.headRefName ] + $labels | map(select(. != null)) | join(" ")) as $signals
      | ($signals | test("security|cve-[0-9]{4}-[0-9]+|ghsa-|vuln|vulnerability"; "i")) as $security
      | ($files | map(.filename) | any(test("^\\.github/workflows/|(^|[/._-])(auth|guardrail|guardrails|security)([/._-]|$)"; "i"))) as $sensitive_paths
      | (($labels | index("squad:chore-auto")) and ($labels | index("leela:approved")) and ((($security or $sensitive_paths) | not) or ($labels | index("zapp:approved"))))
        or ($labels | contains(["leela:approved", "zapp:approved"]))
    '
    ```
    Must return `true`.

2. **Conversation resolution** — all review threads resolved:
   ```bash
   GH_TOKEN=$TOKEN gh pr view {number} --json reviewThreads --jq '[.reviewThreads[] | select(.isResolved == false)] | length'
   ```
   Must return `0`.

If either check fails — STOP. Do not merge. Comment on the PR requesting the missing approval path from Leela or Zapp.

**NEVER use `--admin` flag.** Branch protection exists to enforce review. Bypassing it with `--admin` defeats the entire gate. If protection blocks a merge, that is correct behavior — request review, do not force.

**Why this exists:** Squad agents push PRs under the same GitHub user account as the repo owner. Authors cannot approve their own PRs in GitHub, so the "1 required approving review" gate permanently blocked every squad PR. The label-based gate replaces that with a status check that squad agents can satisfy.

### Merging

Once merge gate checks pass, all reviews are addressed, threads resolved, and CI is green:
```bash
GH_TOKEN=$TOKEN gh pr merge <N> --squash --delete-branch
```

Qualifying GitHub PRs can now skip the manual merge command: the `Squad Auto Merge` workflow arms squash auto-merge when trusted merge signals are green (`CI Gate` from workflow `CI` plus `squad/review-gate` from `Squad Review Gate`), the PR is neither XL (>1000 changed lines) nor titled `refactor`, and one of these approval paths is satisfied on the current head:

- standard path: fresh `leela:approved` + `zapp:approved`
- low-risk path: opt-in `squad:chore-auto` + fresh `leela:approved`
- low-risk sensitive path: opt-in `squad:chore-auto` + fresh `leela:approved` + `zapp:approved` when the PR text looks security-sensitive or it touches `.github/workflows/**`, auth, guardrail, or security code

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
□ Assign issue to current user (GH_TOKEN=$TOKEN gh api user -q .login)
□ Set milestone
□ Update board → In progress
□ Issue has exactly one `estimate:*` label
□ Post Design Proposal (DP) comment on issue with `Estimate: <S/M/L/XL>`
□ Leela approves DP (architecture)
□ Zapp approves DP (security)
□ Create branch: squad/{N}-{slug}
□ Implement (design already approved)
□ Open draft PR: GH_TOKEN=$TOKEN gh pr create --draft
□ Post progress comments on PR
□ Rebase if behind main (never merge)
□ All CI green
□ GH_TOKEN=$TOKEN gh pr ready
□ Request @copilot review via API
□ Leela reviews code quality
□ Zapp reviews security
□ Address all review comments
□ Resolve all threads
□ Update board → In review
□ GH_TOKEN=$TOKEN gh pr merge --squash --delete-branch
□ Update board → Done
```
