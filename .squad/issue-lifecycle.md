# Issue Lifecycle — Repo Connection & PR Flow

Reference for connecting Squad to a repository and managing the issue→branch→PR→merge lifecycle.

## Repo Connection Format

When connecting Squad to an issue tracker, store the connection in `.squad/team.md`:

```markdown
## Issue Source

**Repository:** {owner}/{repo}  
**Connected:** {date}  
**Platform:** {GitHub | Azure DevOps | Planner}  
**Filters:**
- Labels: `{label-filter}`
- Project: `{project-name}` (ADO/Planner only)
- Plan: `{plan-id}` (Planner only)
```

**Detection triggers:**
- User says "connect to {repo}"
- User says "monitor {repo} for issues"
- Ralph is activated without an issue source

## Platform-Specific Issue States

Each platform tracks issue lifecycle differently. Squad normalizes these into a common board state.

### GitHub

| GitHub State | GitHub API Fields | Squad Board State |
|--------------|-------------------|-------------------|
| Open, no assignee | `state: open`, `assignee: null` | `untriaged` |
| Open, assigned, no branch | `state: open`, `assignee: @user`, no linked PR | `assigned` |
| Open, branch exists | `state: open`, linked branch exists | `inProgress` |
| Open, PR opened | `state: open`, PR exists, `reviewDecision: null` | `needsReview` |
| Open, PR approved | `state: open`, PR `reviewDecision: APPROVED` | `readyToMerge` |
| Open, changes requested | `state: open`, PR `reviewDecision: CHANGES_REQUESTED` | `changesRequested` |
| Open, CI failure | `state: open`, PR `statusCheckRollup: FAILURE` | `ciFailure` |
| Closed | `state: closed` | `done` |

**Issue labels used by Squad:**
- `squad` — Issue is in Squad backlog
- `squad:{member}` — Assigned to specific agent
- `squad:untriaged` — Needs triage
- `go:needs-research` — Needs investigation before implementation
- `priority:p{N}` — Priority level (0=critical, 1=high, 2=medium, 3=low)
- `next-up` — Queued for next agent pickup

**Branch naming convention:**
```
squad/{issue-number}-{kebab-case-slug}
```
Example: `squad/42-fix-login-validation`

### Azure DevOps

| ADO State | Squad Board State |
|-----------|-------------------|
| New | `untriaged` |
| Active, no branch | `assigned` |
| Active, branch exists | `inProgress` |
| Active, PR opened | `needsReview` |
| Active, PR approved | `readyToMerge` |
| Resolved | `done` |
| Closed | `done` |

**Work item tags used by Squad:**
- `squad` — Work item is in Squad backlog
- `squad:{member}` — Assigned to specific agent

**Branch naming convention:**
```
squad/{work-item-id}-{kebab-case-slug}
```
Example: `squad/1234-add-auth-module`

### Microsoft Planner

Planner does not have native Git integration. Squad uses Planner for task tracking and GitHub/ADO for code management.

| Planner Status | Squad Board State |
|----------------|-------------------|
| Not Started | `untriaged` |
| In Progress, no PR | `inProgress` |
| In Progress, PR opened | `needsReview` |
| Completed | `done` |

**Planner→Git workflow:**
1. Task created in Planner bucket
2. Agent reads task from Planner
3. Agent creates branch in GitHub/ADO repo
4. Agent opens PR referencing Planner task ID in description
5. Agent marks task as "Completed" when PR merges

## Issue → Branch → PR → Merge Lifecycle

### 1. Issue Assignment (Triage)

**Trigger:** Ralph detects an untriaged issue or user manually assigns work.

**Actions:**
1. Read `.squad/routing.md` to determine which agent should handle the issue
2. Apply `squad:{member}` label (GitHub) or tag (ADO)
3. Transition issue to `assigned` state
4. Optionally spawn agent immediately if issue is high-priority

**Issue read command:**
```bash
# GitHub
gh issue view {number} --json number,title,body,labels,assignees

# Azure DevOps
az boards work-item show --id {id} --output json
```

### 2. Branch Creation & Work Start

**Trigger:** Agent accepts issue assignment and begins work.

**Actions:**
1. Ensure working on latest base branch (usually `main` or `dev`)
2. Create feature branch using Squad naming convention
3. **Post a start comment on the issue** (using GitHub App identity)
4. **Move the issue to "In Progress" on the project board** (using GitHub App identity)
5. Transition issue to `inProgress` state

**Start comment and board transition (GitHub — using bot identity):**

Agents MUST use their GitHub App token for these calls so the comment appears as the bot, not the human user.

```bash
# Resolve bot token (see GIT IDENTITY in spawn prompt)
TOKEN=$(node "{team_root}/.squad/scripts/resolve-token.mjs" "{role_slug}")
if [ -z "$TOKEN" ] && [ "${SQUAD_ALLOW_WRITE_FALLBACK:-0}" != "1" ]; then
  echo "Bot token resolution failed; refusing write action without SQUAD_ALLOW_WRITE_FALLBACK=1" >&2
  exit 1
fi

# Post start comment on the issue
if [ -n "$TOKEN" ]; then
  GH_TOKEN=$TOKEN gh issue comment {number} --repo {owner}/{repo} \
    --body "🚀 **{AgentName}** ({Role}) is starting work on this issue.
⏱️ Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)
🌿 Branch: \`squad/{issue-number}-{slug}\`"
else
  gh issue comment {number} --repo {owner}/{repo} \
    --body "🚀 **{AgentName}** ({Role}) is starting work on this issue.
⏱️ Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)
🌿 Branch: \`squad/{issue-number}-{slug}\`"
fi

# Move issue to "In Progress" on the project board
# Use the GitHub Projects GraphQL API to update the status field
if [ -n "$TOKEN" ]; then
  GH_TOKEN=$TOKEN gh api graphql -f query='
    mutation {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: "{project-node-id}"
          itemId: "{item-node-id}"
          fieldId: "{status-field-id}"
          value: { singleSelectOptionId: "{in-progress-option-id}" }
        }
      ) { projectV2Item { id } }
    }'
else
  gh api graphql -f query='
    mutation {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: "{project-node-id}"
          itemId: "{item-node-id}"
          fieldId: "{status-field-id}"
          value: { singleSelectOptionId: "{in-progress-option-id}" }
        }
      ) { projectV2Item { id } }
    }'
fi
```

> **Write-auth escape hatch:** Write actions fail closed by default. Set `SQUAD_ALLOW_WRITE_FALLBACK=1` only when you intentionally want to use ambient `gh`/`git` auth and can audit that choice.

> **Board IDs:** The coordinator resolves project/item/field/option IDs before spawning and passes them in the ISSUE CONTEXT block. See spawn prompt additions below.

**Branch creation — worktree required:**

Agents always branch inside a dedicated worktree under `.worktrees/`. Branching in the top-level checkout is not allowed: multiple agents on the same checkout cause dirty diffs, wrong-base branches, and lost work.

```bash
git fetch origin
git worktree list                                      # reuse if one already exists
git worktree add .worktrees/{issue-number-or-slug} \
  -b squad/{issue-number}-{slug} origin/main
cd .worktrees/{issue-number-or-slug}
```

### 3. Implementation & Commit

**Actions:**
1. Agent makes code changes
2. Commits reference the issue number
3. Pushes branch to remote

**Commit message format:**
```
{type}({scope}): {description} (#{issue-number})

{detailed explanation if needed}

{breaking change notice if applicable}

Closes #{issue-number}

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

**Commit types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `style`, `build`, `ci`

**Push command:**
```bash
TOKEN=$(node "{team_root}/.squad/scripts/resolve-token.mjs" "{role_slug}")
if [ -z "$TOKEN" ] && [ "${SQUAD_ALLOW_WRITE_FALLBACK:-0}" != "1" ]; then
  echo "Bot token resolution failed; refusing write action without SQUAD_ALLOW_WRITE_FALLBACK=1" >&2
  exit 1
fi

if [ -n "$TOKEN" ]; then
  git push https://x-access-token:${TOKEN}@github.com/{owner}/{repo}.git squad/{issue-number}-{slug}
else
  git push -u origin squad/{issue-number}-{slug}
fi
```

### 4. PR Creation

**Trigger:** Agent completes implementation and is ready for review.

**Actions:**
1. Open PR from feature branch to base branch
2. Reference issue in PR description
3. Apply labels if needed
4. Transition issue to `needsReview` state

**PR creation commands:**

**GitHub:**
```bash
TOKEN=$(node "{team_root}/.squad/scripts/resolve-token.mjs" "{role_slug}")
if [ -z "$TOKEN" ] && [ "${SQUAD_ALLOW_WRITE_FALLBACK:-0}" != "1" ]; then
  echo "Bot token resolution failed; refusing write action without SQUAD_ALLOW_WRITE_FALLBACK=1" >&2
  exit 1
fi

cat > pr-body.txt <<'EOF'
🤖 Created by [{app_slug}](https://github.com/apps/{app_slug})

Closes #{issue-number}

{description}
EOF

if [ -n "$TOKEN" ]; then
  GH_TOKEN=$TOKEN gh pr create --title "{title}" \
    --body-file pr-body.txt \
    --head squad/{issue-number}-{slug} \
    --base main
else
  gh pr create --title "{title}" \
    --body-file pr-body.txt \
    --head squad/{issue-number}-{slug} \
    --base main
fi
```

**Azure DevOps:**
```bash
az repos pr create --title "{title}" \
  --description "Closes #{work-item-id}\n\n{description}" \
  --source-branch squad/{work-item-id}-{slug} \
  --target-branch main
```

**PR description template:**
```markdown
🤖 Created by [{app_slug}](https://github.com/apps/{app_slug})

Closes #{issue-number}

## Summary
{what changed}

## Changes
- {change 1}
- {change 2}

## Testing
{how this was tested}

## Time Spent
- Implementation: {X} min
- Feedback rounds: {Y} min ({N} rounds)
- Total: {Z} min

{If working as a squad member:}
Working as {member} ({role})

{If needs human review:}
⚠️ This task was flagged as "needs review" — please have a squad member review before merging.
```

### 5. PR Review & Updates

**Review states:**
- **Approved** → `readyToMerge`
- **Changes requested** → `changesRequested`
- **CI failure** → `ciFailure`

**When changes are requested:**
1. **Post an acknowledgment comment on the PR** (using bot identity) before making any changes
2. Agent addresses feedback
3. Commits fixes to the same branch
4. Pushes updates
5. Posts a completion comment summarizing what was changed
6. Requests re-review

**Feedback acknowledgment (GitHub — using bot identity):**

```bash
TOKEN=$(node "{team_root}/.squad/scripts/resolve-token.mjs" "{role_slug}")
if [ -z "$TOKEN" ] && [ "${SQUAD_ALLOW_WRITE_FALLBACK:-0}" != "1" ]; then
  echo "Bot token resolution failed; refusing write action without SQUAD_ALLOW_WRITE_FALLBACK=1" >&2
  exit 1
fi

# Before making changes
if [ -n "$TOKEN" ]; then
  GH_TOKEN=$TOKEN gh pr comment {pr-number} --repo {owner}/{repo} \
    --body "🔧 **{AgentName}** ({Role}) is addressing review feedback.
⏱️ Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
else
  gh pr comment {pr-number} --repo {owner}/{repo} \
    --body "🔧 **{AgentName}** ({Role}) is addressing review feedback.
⏱️ Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

# After pushing changes
if [ -n "$TOKEN" ]; then
  GH_TOKEN=$TOKEN gh pr comment {pr-number} --repo {owner}/{repo} \
    --body "✅ **{AgentName}** addressed the feedback.
⏱️ Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Changes:** {summary}
Ready for re-review."
else
  gh pr comment {pr-number} --repo {owner}/{repo} \
    --body "✅ **{AgentName}** addressed the feedback.
⏱️ Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Changes:** {summary}
Ready for re-review."
fi
```

> Write actions fail closed by default. Use `SQUAD_ALLOW_WRITE_FALLBACK=1` only as an explicit, auditable escape hatch for ambient auth.

**Update workflow:**
```bash
# Make changes
# ⚠️ NEVER use `git add .` or `git add -A` — only stage files you intentionally changed
git add -- {specific files you modified}
git commit -m "fix: address review feedback"
git push
```

**Re-request review (GitHub):**
```bash
gh pr ready {pr-number}
```

### 6. PR Merge

**Trigger:** PR is approved and CI passes.

**Merge strategies:**

**GitHub (merge commit):**
```bash
gh pr merge {pr-number} --merge --delete-branch
```

**GitHub (squash):**
```bash
gh pr merge {pr-number} --squash --delete-branch
```

**Azure DevOps:**
```bash
az repos pr update --id {pr-id} --status completed --delete-source-branch true
```

**Post-merge actions:**
1. Issue automatically closes (if "Closes #{number}" is in PR description)
2. Feature branch is deleted on the remote
3. Squad board state transitions to `done`
4. Worktree is removed locally

### 7. Cleanup

From any checkout other than the worktree you're removing:

```bash
git worktree remove .worktrees/{issue-number-or-slug}
git worktree prune
```

If the worktree has uncommitted changes, move them first. `git worktree remove` refusing to delete is usually a signal that something went wrong and needs attention.

## Spawn Prompt Additions for Issue Work

When spawning an agent to work on an issue, include this context block:

```markdown
## ISSUE CONTEXT

**Issue:** #{number} — {title}  
**Platform:** {GitHub | Azure DevOps | Planner}  
**Repository:** {owner}/{repo}  
**Assigned to:** {member}

**Description:**
{issue body}

**Labels/Tags:**
{labels}

**Acceptance Criteria:**
{criteria if present in issue}

**Branch:** `squad/{issue-number}-{slug}`

**Your task:**
{specific directive to the agent}

**Project Board IDs** (for moving issue on the board):
- Project Node ID: `{project-node-id}`
- Item Node ID: `{item-node-id}`
- Status Field ID: `{status-field-id}`
- "In Progress" Option ID: `{in-progress-option-id}`
- "Done" Option ID: `{done-option-id}`

## WORK START PROTOCOL

🚀 **Before writing any code**, you MUST:

1. **Post a start comment on the issue** using your bot identity:
   ```bash
   TOKEN=$(node "{team_root}/.squad/scripts/resolve-token.mjs" "{role_slug}")
   if [ -z "$TOKEN" ] && [ "${SQUAD_ALLOW_WRITE_FALLBACK:-0}" != "1" ]; then
     echo "Bot token resolution failed; refusing write action without SQUAD_ALLOW_WRITE_FALLBACK=1" >&2
     exit 1
   fi
   if [ -n "$TOKEN" ]; then
     GH_TOKEN=$TOKEN gh issue comment {number} --repo {owner}/{repo} \
       --body "🚀 **{AgentName}** ({Role}) is starting work on this issue.
   ⏱️ Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)
   🌿 Branch: \`squad/{issue-number}-{slug}\`"
   else
     gh issue comment {number} --repo {owner}/{repo} \
       --body "🚀 **{AgentName}** ({Role}) is starting work on this issue.
   ⏱️ Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)
   🌿 Branch: \`squad/{issue-number}-{slug}\`"
   fi
   ```

2. **Move the issue to "In Progress" on the project board:**
   ```bash
   if [ -n "$TOKEN" ]; then
     GH_TOKEN=$TOKEN gh api graphql -f query='
       mutation { updateProjectV2ItemFieldValue(input: {
         projectId: "{project-node-id}", itemId: "{item-node-id}",
         fieldId: "{status-field-id}",
         value: { singleSelectOptionId: "{in-progress-option-id}" }
       }) { projectV2Item { id } } }'
   else
     gh api graphql -f query='
       mutation { updateProjectV2ItemFieldValue(input: {
         projectId: "{project-node-id}", itemId: "{item-node-id}",
         fieldId: "{status-field-id}",
         value: { singleSelectOptionId: "{in-progress-option-id}" }
       }) { projectV2Item { id } } }'
   fi
   ```

> Write actions fail closed by default. Use `SQUAD_ALLOW_WRITE_FALLBACK=1` only as an explicit, auditable escape hatch for ambient auth.

## FEEDBACK ACKNOWLEDGMENT PROTOCOL

📝 **If this is a feedback round** (addressing PR review or issue comments):
1. Post `🔧 {Name} is addressing review feedback...` on the PR/issue BEFORE changes
2. Post `✅ {Name} addressed the feedback` with summary AFTER pushing

## TIME TRACKING

⏱️ **You MUST track time spent on this issue.** The coordinator records spawn and completion timestamps in the orchestration log. Your responsibilities:

1. **Note your start** — at the very beginning of your work, before any file reads or code changes, output:
   `⏱️ STARTED: {ISO 8601 UTC timestamp}`
2. **Note your finish** — as the last thing before your final summary, output:
   `⏱️ COMPLETED: {ISO 8601 UTC timestamp}`
3. **If this is a feedback round** (addressing PR review comments), additionally output:
   `⏱️ FEEDBACK_ROUND: yes`
4. **Include time in your PR description** — add a `## Time Spent` section:
   ```
   ## Time Spent
   - Implementation: {X} min
   - Feedback rounds: {Y} min (N rounds)
   - Total: {Z} min
   ```

This data feeds Sprint Retro velocity analysis and Sprint Planning estimation.

**After completing work:**
1. Commit with message referencing issue number
2. Push branch
3. Open PR using:
   ```
   TOKEN=$(node "{team_root}/.squad/scripts/resolve-token.mjs" "{role_slug}")
   if [ -z "$TOKEN" ] && [ "${SQUAD_ALLOW_WRITE_FALLBACK:-0}" != "1" ]; then
     echo "Bot token resolution failed; refusing write action without SQUAD_ALLOW_WRITE_FALLBACK=1" >&2
     exit 1
   fi
   cat > pr-body.txt <<'EOF'
   🤖 Created by [{app_slug}](https://github.com/apps/{app_slug})

   Closes #{number}

   {description}
   EOF
   if [ -n "$TOKEN" ]; then
     GH_TOKEN=$TOKEN gh pr create --title "{title}" --body-file pr-body.txt --head squad/{issue-number}-{slug} --base {base-branch}
   else
     gh pr create --title "{title}" --body-file pr-body.txt --head squad/{issue-number}-{slug} --base {base-branch}
   fi
   ```
4. Report PR URL and time spent to coordinator
```

## Ralph's Role in Issue Lifecycle

Ralph (the work monitor) continuously checks issue and PR state:

1. **Triage:** Detects untriaged issues, assigns `squad:{member}` labels
2. **Spawn:** Launches agents for assigned issues
3. **Monitor:** Tracks PR state transitions (needsReview → changesRequested → readyToMerge)
4. **Merge:** Automatically merges approved PRs
5. **Cleanup:** Marks issues as done when PRs merge

**Ralph's work-check cycle:**
```
Scan → Categorize → Dispatch → Watch → Report → Loop
```

See `.squad/templates/ralph-reference.md` for Ralph's full lifecycle.

## PR Review Handling

### Automated Approval (CI-only projects)

If the project has no human reviewers configured:
1. PR opens
2. CI runs
3. If CI passes, Ralph auto-merges
4. Issue closes

### Human Review Required

If the project requires human approval:
1. PR opens
2. Human reviewer is notified (GitHub/ADO notifications)
3. Reviewer approves or requests changes
4. If approved + CI passes, Ralph merges
5. If changes requested, agent addresses feedback

### Squad Member Review

If the issue was assigned to a squad member and they authored the PR:
1. Another squad member reviews (conflict of interest avoidance)
2. Original author is locked out from re-working rejected code (rejection lockout)
3. Reviewer can approve edits or reject outright

## Common Issue Lifecycle Patterns

### Pattern 1: Quick Fix (Single Agent, No Review)
```
Issue created → Assigned to agent → Branch created → Code fixed → 
PR opened → CI passes → Auto-merged → Issue closed
```

### Pattern 2: Feature Development (Human Review)
```
Issue created → Assigned to agent → Branch created → Feature implemented → 
PR opened → Human reviews → Changes requested → Agent fixes → 
Re-reviewed → Approved → Merged → Issue closed
```

### Pattern 3: Research-Then-Implement
```
Issue created → Labeled `go:needs-research` → Research agent spawned → 
Research documented → Research PR merged → Implementation issue created → 
Implementation agent spawned → Feature built → PR merged
```

### Pattern 4: Parallel Multi-Agent
```
Epic issue created → Decomposed into sub-issues → Each sub-issue assigned → 
Multiple agents work in parallel worktrees → PRs opened concurrently → 
All PRs reviewed → All PRs merged → Epic closed
```

## Anti-Patterns

- ❌ Creating branches without linking to an issue
- ❌ Committing without issue reference in message
- ❌ Opening PRs without "Closes #{number}" in description
- ❌ Merging PRs before CI passes
- ❌ Leaving feature branches undeleted after merge
- ❌ Running `git checkout -b` in the top-level checkout — always use a worktree under `.worktrees/`
- ❌ Manually transitioning issue states — let the platform and Squad automation handle it
- ❌ Skipping the branch naming convention — breaks Ralph's tracking logic
