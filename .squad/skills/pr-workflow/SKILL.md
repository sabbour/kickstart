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
   - `Estimate: <S/M/L/XL>` (required; must match the issue label. Calibration for a 6h sprint: S≈15m/1 point, M≈1h/3 points, L≈3h/8 points, XL>3h/20 points — XL does NOT enter a sprint, split it)
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
     --base dev
   ```

2. **Post findings as PR comments** as work progresses:
   ```bash
   GH_TOKEN=$TOKEN gh pr comment <N> --body "📝 Progress: ..."
   ```

### Keeping the Branch Current

#### Why this matters — `strict_required_status_checks_policy: true`

The `ci-gate` repository ruleset has `strict_required_status_checks_policy: true`. This means **every branch must be up to date with `dev` before GitHub will merge it** — even if all required status checks are already green and auto-merge is enabled. A PR in the `BEHIND` state will stay permanently stuck at "Waiting" until its branch is updated.

This trips up multiple PRs at once whenever a PR merges into `dev` (all remaining PRs immediately become `BEHIND`).

#### Updating a branch (preferred — no rebase needed)

Use the GitHub API to merge `dev` into the PR branch. This creates a new merge commit (no force-push), but the new SHA will not have any existing commit statuses — workflows must re-run on the new SHA:

```bash
gh api --method PUT repos/azure-management-and-platforms/kickstart/pulls/<N>/update-branch
```

If the branch has conflicts (state `DIRTY`), the API call will fail — resolve conflicts locally then force-push (see below).

To update all open PRs that are `BEHIND` in one pass:

```bash
gh pr list --state open --json number,mergeStateStatus \
  | jq -r '.[] | select(.mergeStateStatus=="BEHIND") | .number' \
  | xargs -I{} gh api --method PUT repos/azure-management-and-platforms/kickstart/pulls/{}/update-branch
```

#### After updating — re-trigger the review gate (manual fallback)

`squad/review-gate` commit statuses are SHA-specific. After `update-branch` creates a new merge commit, the new SHA has no `squad/review-gate` status and GitHub shows **"Expected — Waiting for status to be reported"**, blocking auto-merge.

Since PR #156 added `pull_request.synchronize` to `squad-review-gate.yml`, the gate **re-evaluates automatically** whenever a new commit is pushed — including after `update-branch`. You should not need to cycle a label manually.

If the workflow does not fire automatically (e.g., CI queue delay or a missed event), you can force re-evaluation by cycling a label:

```bash
# Manual fallback only — normally not required since synchronize trigger fires automatically
gh api --method DELETE repos/azure-management-and-platforms/kickstart/issues/<N>/labels/docs:not-applicable
gh api --method POST   repos/azure-management-and-platforms/kickstart/issues/<N>/labels -f 'labels[]=docs:not-applicable'
```

> **Note:** `gh pr edit --add-label` is observed to silently fail on this repo — always use the REST API (`gh api --method POST`) for label writes.

#### Resolving conflicts (DIRTY state)

When the PR is `DIRTY` (has merge conflicts), the API update will fail. Fix locally:

```bash
git fetch origin
git rebase origin/dev
# Resolve any conflicts
git push https://x-access-token:${TOKEN}@github.com/azure-management-and-platforms/kickstart.git squad/<issue-number>-<slug> --force-with-lease
```

Then re-trigger the gate as above.

### Marking Ready for Review

Only after work is complete AND CI passes:
```bash
GH_TOKEN=$TOKEN gh pr ready <N>
```

### Review Gates

Before a PR can merge, it must pass the **four-way review gate**:

1. **Leela** — architecture alignment with the approved DP
2. **Zapp** — security concerns (auth, injection, secrets, CORS)
3. **Nibbler** — code quality, test coverage, maintainability
4. **Docs (Amy)** — documentation coverage for any new interface, API, behavior, or developer-facing surface

Zapp's review is a **pre-merge gate** for foundational patterns. Nibbler reviews every PR (including `squad:chore-auto`) because code-quality review is cheap and fast. The docs gate is satisfied by **one of** `docs:approved` or `docs:not-applicable`; `docs:rejected` fails the gate.

#### Amy's Docs Scope — What Counts as In-Scope

Amy's docs review scope is **not limited to user-facing content**. It includes:

- User-facing docs: README, setup guides, environment variable references
- Engineering and developer guides (guides for contributors and pack authors)
- Architecture Decision Records (ADRs) under `docs-site/docs/architecture/decisions/`
- API and interface documentation for any **new exported interface, class, or function** (e.g., `ISessionStore`, `asTool()`, `runChain()`)
- Agent/SDK-level documentation (new agent runner behaviors, new session abstractions, new harness APIs)
- Docusaurus site content covering architecture and engineering patterns
- Developer tooling changes that affect how contributors write code (ESLint rules, schema requirements)

#### When `docs:not-applicable` Is Appropriate

`docs:not-applicable` should **only** be applied when **all** of the following are true:

1. The PR is a **pure internal refactor** with no new interfaces, behaviors, or APIs exposed to callers or contributors.
2. OR the PR is a **trivial bug fix** that changes no observable behavior and introduces no new concepts.
3. OR the PR is **tooling/CI/config only** with no developer-facing surface.
4. AND the DP explicitly stated `Docs impact: N/A` **AND** that claim holds up under Amy's scrutiny.

**Implementing agents (Bender, Fry, Hermes, @copilot) must NOT self-apply `docs:not-applicable`.** Only Amy can apply this label — it requires Amy's explicit sign-off that no documentation is warranted. If an implementing agent believes docs are not needed, they should note it in the PR description; Amy will make the final call.

Examples of PRs that are **NOT** `docs:not-applicable` even if they seem internal:
- New exported interface or class (e.g., `ISessionStore`) → developer guide needed
- New harness API (e.g., `asTool()`, `runChain()`) → API reference needed
- New runtime behavior (e.g., guardrail pipeline, thread ID persistence) → guide/README update needed
- Architecture change with accepted tradeoffs → ADR needed
- New environment variable (e.g., `KICKSTART_USE_RESPONSES`, `KICKSTART_GUARDRAILS_DISABLED`) → env-vars reference update needed
- New ESLint rules affecting contributor workflow → contributing guide update needed
- New user-visible UI state (e.g., Demo Mode badge, recovery card) → user guide update needed

**How approvals work (label-based):**
- **Leela** approves by adding the `architecture:approved` label:
  ```bash
  GH_TOKEN=$TOKEN gh pr edit {number} --add-label "architecture:approved" --repo azure-management-and-platforms/kickstart
  ```
- **Zapp** approves by adding the `security:approved` label:
  ```bash
  GH_TOKEN=$TOKEN gh pr edit {number} --add-label "security:approved" --repo azure-management-and-platforms/kickstart
  ```
- **Nibbler** approves by adding the `codereview:approved` label:
  ```bash
  GH_TOKEN=$TOKEN gh pr edit {number} --add-label "codereview:approved" --repo azure-management-and-platforms/kickstart
  ```
- **Amy (Docs)** approves by adding `docs:approved` (docs written or updated in the PR) or `docs:not-applicable` (Amy has reviewed and confirmed no documentation is needed). **Implementing agents must not self-apply `docs:not-applicable`.**
  ```bash
  GH_TOKEN=$TOKEN gh pr edit {number} --add-label "docs:approved" --repo azure-management-and-platforms/kickstart
  ```

No GitHub formal PR review approval is required — squad agents share a single GitHub account with the repo owner, making self-approval impossible. The `squad/review-gate` status check (`.github/workflows/squad-review-gate.yml`) turns green when all required labels are present **and** a docs marker is present. For explicitly low-risk PRs labeled `squad:chore-auto`, the gate accepts `architecture:approved` + `codereview:approved` + docs marker, unless the PR looks security-sensitive (`security`, `GHSA`, `CVE`, `vulnerability`) or touches sensitive paths (`.github/workflows/**`, auth, guardrail, security code), in which case `security:approved` is still required. `Squad Auto Merge` clears all three approval labels (`architecture:approved`, `security:approved`, `codereview:approved`) on every `synchronize` so new commits always need fresh approval labels. Docs markers persist across synchronize (they describe the PR content, not a reviewer's per-commit signoff).

### Requesting Copilot Review

Use the REST API (not comment mentions):
```bash
REPO_NWO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
GH_TOKEN=$TOKEN gh api "repos/${REPO_NWO}/pulls/<N>/requested_reviewers" \
  --method POST \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
```

### Handling Review Feedback

**Review sources — all carry equal weight and none can be skipped:**
- `copilot-pull-request-reviewer[bot]` (GitHub Copilot PR review bot)
- Squad reviewers: Leela, Zapp, Nibbler, Amy
- Human reviewers

**❌ FORBIDDEN: Resolving a thread without first posting a reply.** This applies even if the code was already fixed. The reply is the proof that the feedback was read and considered. Fix + reply + resolve is an indivisible unit. If you resolve a thread without a reply, re-open it and add the reply before merge.

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
   GH_TOKEN=$TOKEN gh api "repos/azure-management-and-platforms/kickstart/pulls/<PR>/comments/<comment_id>/replies" \
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
   UNRESOLVED=$(GH_TOKEN=$TOKEN gh pr view <N> --json reviewThreads --jq '.reviewThreads | map(select(.isResolved == false)) | length')
   # Must be 0 before proceeding
   ```

**NEVER silently fix code and move on.** A reply is required for every piece of feedback, even if the fix is trivial. This is not optional.

**Why this matters:** `require_conversation_resolution: true` is enforced in branch protection. Unresolved threads block the `squad/review-gate` status check. Even if the required label set for the PR is present (`architecture:approved` + `security:approved` + `codereview:approved` + one of `docs:approved` / `docs:not-applicable`, or the low-risk `squad:chore-auto` path), GitHub will not allow merge while threads are open.

### CI Requirements

All CI checks must pass, including Playwright E2E tests. If checks fail:
1. Spawn the owning agent to fix failures
2. Keep iterating until CI is green
3. Do NOT merge PRs with failing required checks

### Merge Gate

**Rule:** Never call `GH_TOKEN=$TOKEN gh pr merge` without first verifying ALL of the following:

1. **Squad label gate** — verify the PR satisfies one of the allowed approval paths on the current head:
    - standard path: `architecture:approved` + `security:approved` + `codereview:approved` + (`docs:approved` OR `docs:not-applicable`)
    - low-risk path: `squad:chore-auto` + `architecture:approved` + `codereview:approved` + (`docs:approved` OR `docs:not-applicable`)
    - low-risk sensitive path: `squad:chore-auto` + `architecture:approved` + `codereview:approved` + `security:approved` + (`docs:approved` OR `docs:not-applicable`) when the PR text looks security-sensitive or it touches `.github/workflows/**`, auth, guardrail, or security code
    - Any path fails immediately if `architecture:rejected`, `security:rejected`, `codereview:rejected`, or `docs:rejected` is present.

    ```bash
    PR_JSON=$(GH_TOKEN=$TOKEN gh pr view {number} --json number,title,body,headRefName,labels)
    FILES_JSON=$(GH_TOKEN=$TOKEN gh api repos/azure-management-and-platforms/kickstart/pulls/{number}/files --paginate)
    jq -n --argjson pr "$PR_JSON" --argjson files "$FILES_JSON" '
      ($pr.labels | map(.name)) as $labels
      | ([ $pr.title, $pr.body, $pr.headRefName ] + $labels | map(select(. != null)) | join(" ")) as $signals
      | ($signals | test("security|cve-[0-9]{4}-[0-9]+|ghsa-|vuln|vulnerability"; "i")) as $security
      | ($files | map(.filename) | any(test("^\\.github/workflows/|(^|[/._-])(auth|guardrail|guardrails|security)([/._-]|$)"; "i"))) as $sensitive_paths
      | (($labels | index("docs:approved")) or ($labels | index("docs:not-applicable"))) as $docs_ok
      | (($labels | index("docs:rejected")) | not) as $docs_not_rejected
      | (($labels | index("architecture:rejected")) | not) as $no_leela_reject
      | (($labels | index("security:rejected")) | not) as $no_zapp_reject
      | (($labels | index("codereview:rejected")) | not) as $no_nibbler_reject
      | (($labels | index("architecture:approved")) and ($labels | index("codereview:approved"))) as $core_ok
      | (($labels | index("squad:chore-auto")) and $core_ok and ((($security or $sensitive_paths) | not) or ($labels | index("security:approved"))))
        or ($core_ok and ($labels | index("security:approved")))
      | . and $docs_ok and $docs_not_rejected and $no_leela_reject and $no_zapp_reject and $no_nibbler_reject
    '
    ```
    Must return `true`.

2. **Conversation resolution** — all review threads resolved:
   ```bash
   GH_TOKEN=$TOKEN gh pr view {number} --json reviewThreads --jq '.reviewThreads | map(select(.isResolved == false)) | length'
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

- standard path: fresh `architecture:approved` + `security:approved` + `codereview:approved` + (`docs:approved` OR `docs:not-applicable`)
- low-risk path: opt-in `squad:chore-auto` + fresh `architecture:approved` + `codereview:approved` + (`docs:approved` OR `docs:not-applicable`)
- low-risk sensitive path: opt-in `squad:chore-auto` + fresh `architecture:approved` + `codereview:approved` + `security:approved` + (`docs:approved` OR `docs:not-applicable`) when the PR text looks security-sensitive or it touches `.github/workflows/**`, auth, guardrail, or security code

Any `*:rejected` label (including `docs:rejected`) disarms auto-merge and fails the `squad/review-gate` status check.

---

## Review Quality Standard

Every PR review submitted by a squad agent MUST:

1. **Read the diff** — `gh pr diff <N>` before writing a single word
2. **Reference specifics** — cite file paths and line numbers (e.g., `packages/foo/bar.ts:42`)
3. **Cover all dimensions:**
   - Correctness: bugs, logic errors, unhandled edge cases
   - Type safety: TypeScript types, `any` usage, exported API types
   - Test coverage: happy path AND error cases, missing scenarios
   - Code quality: naming, duplication, complexity
   - Security: injection risks, unvalidated input, exposed secrets
4. **Minimum 150 words** of substantive content — not counting template headers
5. **Use REQUEST_CHANGES** when issues are found — do not APPROVE with caveats
6. **Re-reviews after rebase:** Must explicitly list what was verified as functionally unchanged. "Re-approving after rebase ✅" is **forbidden**.

One-liner approvals are a governance violation and will be dismissed.

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

### Proactive BEHIND Branch Scan (run SECOND, every cycle)

Run this AFTER the thread scan and BEFORE checking CI or merge readiness.

```bash
# Identify all BEHIND PRs
gh pr list --repo azure-management-and-platforms/kickstart --state open \
  --json number,title,mergeStateStatus \
  --jq '.[] | select(.mergeStateStatus=="BEHIND") | "#\(.number) \(.title)"'
```

**Per-PR update procedure:**
1. Attempt update-branch via the API (never pass a body — `expected_head_sha=""` causes HTTP 422):
   ```bash
   gh api repos/azure-management-and-platforms/kickstart/pulls/<N>/update-branch -X PUT
   ```
2. Success → GitHub triggers `squad-review-gate.yml` automatically via `pull_request.synchronize` — no label cycling needed.
3. HTTP 422 "merge conflict between base and head" → real conflict. Route to the implementing agent with the worktree path for manual rebase.

**Why this matters:** Every PR that merges into `dev` makes ALL remaining open PRs `BEHIND`. `strict_required_status_checks_policy: true` means a PR with all green checks and correct labels will silently stay stuck at "Waiting" — forever — until updated. Catching this proactively on every cycle prevents PRs from stalling invisibly.

**Trigger cadence:** Run the scan:
- At the start of every monitoring cycle
- Immediately after any PR merges into `dev`
- Any time a PR shows `UNKNOWN` or `BEHIND` mergeStateStatus

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
□ PROACTIVE: scan ALL open PRs for BEHIND state (see "Proactive BEHIND Branch Scan" section)
□ For each BEHIND PR: gh api repos/azure-management-and-platforms/kickstart/pulls/{N}/update-branch -X PUT
□ HTTP 422 on update-branch → real conflict → route to implementing agent for rebase
□ All CI green
□ GH_TOKEN=$TOKEN gh pr ready
□ Request copilot-pull-request-reviewer[bot] review via API
□ Leela reviews code quality
□ Zapp reviews security
□ Nibbler reviews code quality
□ Docs reviewer applies `docs:approved` or `docs:not-applicable`
□ For EACH review thread (copilot-pull-request-reviewer[bot], squad, human — all equal):
     1. Fix or decide to dismiss
     2. POST reply comment: "Addressed in {sha}: …" OR "Dismissed: {justification}"
     3. THEN resolve thread via resolveReviewThread mutation
     ❌ Do NOT resolve without a reply — forbidden
□ Verify 0 unresolved threads (gh pr view <N> --json reviewThreads --jq '.reviewThreads | map(select(.isResolved==false)) | length')
□ Update board → In review
□ GH_TOKEN=$TOKEN gh pr merge --squash --delete-branch
□ Update board → Done
```
