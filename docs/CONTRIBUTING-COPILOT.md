# Contributing with GitHub Copilot

This guide explains how to contribute to Kickstart using the **Squad workflow** — a team-based, AI-enabled approach to coordinating work across the project.

## Quickstart for Copilot Issues

When you see a GitHub issue labeled `squad:{member}` (e.g., `squad:scribe`, `squad:fry`), that issue is routed to a specific team member. If you're that member, follow this workflow:

1. **Create a worktree** — never branch in the top-level checkout
2. **Work locally** — make commits, push to your branch
3. **Open a PR** — reference the issue, mention your role
4. **Address review comments** — respond to each comment thread
5. **Merge** — all review threads must be resolved

## Squad Labels & Issue Routing

Issues in Kickstart are routed using **labels**:

| Label | Meaning | Who Handles It |
|-------|---------|---|
| `squad` | Unreviewed issue, needs triage | Lead (determines who should work on it) |
| `squad:scribe` | Documentation, release notes, DX | Scribe |
| `squad:fry` | Frontend/UI, React components | Fry (Frontend) |
| `squad:bender` | Backend, API, harness, packs | Bender (Backend) |
| `squad:hermes` | Testing, observability, performance | Hermes (Tester) |
| `squad:zapp` | Security review, auth, guardrails | Zapp (Security) |
| `squad:leela` | Architecture, code quality review | Leela (Lead) |

When an issue gets the `squad:{member}` label, that member picks it up in their next session. If you're assigned to an issue, you can reassign by removing your label and adding another member's label.

## Branch Naming Convention

Always use the Squad branch convention:

```
squad/{issue-number}-{kebab-case-slug}
```

Examples:
- `squad/916-env-variables`
- `squad/917-packs-docs`
- `squad/918-copilot-workflow`

## Worktree Workflow

**Critical:** Never run `git checkout -b` in the main checkout. Each piece of work gets its own **worktree** to avoid conflicts.

### Create a Worktree

```bash
# Navigate to your main checkout
cd /path/to/kickstart

# Fetch latest
git fetch origin

# Create a worktree (replace 916 with your issue number)
git worktree add .worktrees/916-env-variables \
  -b squad/916-env-variables origin/main

# Switch into the worktree
cd .worktrees/916-env-variables
```

### Work Locally

```bash
# Make changes
npm run build      # validate changes build
npm test           # run tests
npm run lint       # check formatting

# Commit your work
git add .
git commit -m "docs: add environment variables guide

This addresses issue #916 by documenting all env vars used in the codebase,
providing a .env.sample template, and updating setup instructions.

Closes #916"
```

:::note Commit trailers
When committing, always include this trailer at the end of your message:

```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

The Git tools will automatically add this for Copilot commits.
:::

### Push and Open a PR

```bash
# Push your branch
git push origin squad/916-env-variables

# Open a PR using GitHub CLI (gh)
gh pr create \
  --title "docs: Document all environment variables (#916)" \
  --body "Closes #916

## Changes
- Added \`docs-site/docs/getting-started/environment-variables.md\`
- Documented all env vars (Azure, OpenAI, runtime, auth)
- Provided .env.sample template
- Updated DEVELOPMENT.md setup instructions

## Testing
- Built docs with \`npm run build\` in docs-site/ ✓
- Validated markdown formatting ✓
"
```

The `gh pr create` command will open a browser to finalize and submit the PR.

### PR Title & Description

Follow this format:

**Title:**
```
<type>: <description> (#issue)
```

Examples:
- `docs: Document environment variables (#916)`
- `test: Add coverage for model resolution (#915)`
- `fix: Resolve merge conflict on squad/918 (#918)`

**Description:**
```
Closes #{issue-number}

## Changes
- What you changed (bullet list)

## Testing
- How you tested it (manual steps or test commands)
```

If this is a **squad:{member}** task, mention the member's role:

```
Closes #916

Working as Scribe (Documentation & Product Voice)

## Changes
- Added environment variables guide
- Provided .env.sample template
```

If this task was flagged as **"needs review"** in the team profile, add:

```
⚠️ This task was flagged as "needs review" — please have a squad member review before merging.
```

## Pull Request Review Gates

Kickstart uses a **review gate system** to ensure quality. Here's who reviews what:

| Review Type | Primary Reviewer | Secondary |
|---|---|---|
| **Code logic & correctness** | Nibbler (Code Reviewer) | Any squad member |
| **Architecture & design** | Leela (Lead) | Domain expert |
| **Security concerns** | Zapp (Security) | Reviewer if needed |
| **Test coverage** | Hermes (Tester) | Nibbler |
| **Documentation** | Scribe | Lead for complex changes |

When you open a PR:
1. GitHub Actions runs automated checks (lint, build, tests)
2. Relevant squad members are notified
3. They post review comments
4. You respond to each comment (see below)
5. After all threads are resolved, the PR can merge

## Addressing Review Comments

When a reviewer posts a comment, you **must respond**. Follow this process:

### 1. Fix the Code

Make the fix locally in your worktree:

```bash
# Make your change
# ... edit files ...

# Commit the fix
git add .
git commit -m "Address review: clarify env var documentation

Reviewer suggested adding Azure endpoint format examples.
Added detail about .cognitiveservices.azure.com vs .openai.azure.com."
```

### 2. Reply to the Comment

Go to the PR's **Conversation** tab, find the comment, and reply:

```
Addressed in abc123d: Added examples of Azure endpoint formats to clarify 
the difference between Azure AI Services and Azure OpenAI endpoints.
```

Include the commit SHA (first 7 chars) so the reviewer can find your fix.

### 3. Resolve the Thread

Click **Resolve conversation** on the comment thread. This tells the reviewer you've addressed their concern.

### 4. Verify All Threads are Resolved

Before merging, check that **all review threads are resolved**. You should see:
- ✅ All conversation threads resolved
- ✅ All GitHub Actions checks passing
- ✅ At least one approval from a reviewer

## Example Workflow: Documenting Environment Variables (Issue #916)

Here's a complete walkthrough:

### Step 1: Create worktree

```bash
cd /path/to/kickstart
git fetch origin
git worktree add .worktrees/916-env-variables \
  -b squad/916-env-variables origin/main
cd .worktrees/916-env-variables
```

### Step 2: Create documentation files

Create `docs-site/docs/getting-started/environment-variables.md` with env var reference.

### Step 3: Update DEVELOPMENT.md

Add a section pointing to the new guide:

```markdown
## Environment Variables

For a complete reference of all environment variables, see [Environment Variables](../docs-site/docs/getting-started/environment-variables.md).
```

### Step 4: Test locally

```bash
npm run build                     # ensure docs build
cd docs-site
npm run build                     # test docs site specifically
```

### Step 5: Commit

```bash
git add docs-site/docs/getting-started/environment-variables.md DEVELOPMENT.md
git commit -m "docs: Document all environment variables

This addresses issue #916 by creating a comprehensive environment variables
guide documenting all Azure OpenAI, runtime, authentication, and feature flag
variables. Includes examples, fallback chains, and troubleshooting.

- Added docs-site/docs/getting-started/environment-variables.md
- Updated DEVELOPMENT.md with link to guide
- Provided .env.sample reference section

Closes #916

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Step 6: Push and open PR

```bash
git push origin squad/916-env-variables

gh pr create \
  --title "docs: Document all environment variables (#916)" \
  --body "Closes #916

## Changes
- Added comprehensive environment variables guide
- Documented Azure OpenAI, runtime, auth, and feature flags
- Included .env.sample template and troubleshooting

## Testing
- Built docs with npm run build ✓
- Validated markdown links ✓"
```

### Step 7: Respond to reviews

Reviewer posts:

```
This is great! Could you add a section on the KICKSTART_PLAYGROUND flag? 
Developers might want to use it for local testing.
```

You fix it:

```bash
# Edit the file to add KICKSTART_PLAYGROUND section
git add docs-site/docs/getting-started/environment-variables.md
git commit -m "docs: Add KICKSTART_PLAYGROUND flag documentation"
git push origin squad/916-env-variables
```

Reply to the comment:

```
Addressed in 2b3c4d5e: Added KICKSTART_PLAYGROUND section explaining 
the flag's purpose and security implications. Thanks for catching that!
```

Click **Resolve conversation**.

### Step 8: Merge

Once all threads are resolved and checks pass:

```bash
gh pr merge --squash  # or use GitHub UI to merge
```

### Step 9: Clean up worktree

Back in your main checkout:

```bash
cd /path/to/kickstart
git worktree remove .worktrees/916-env-variables
git worktree prune
```

## Checklist for PR Submission

Before opening a PR:

- [ ] Branch name follows `squad/{issue}-{slug}` convention
- [ ] All code builds: `npm run build`
- [ ] All tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Commit message includes `Closes #{issue}` and Co-authored-by trailer
- [ ] PR title clearly describes the change
- [ ] PR description references the issue and lists changes

## Common Scenarios

### "My PR has merge conflicts"

The `resolve-conflicts` skill can help:

```bash
# In your worktree
git fetch origin
git rebase origin/main

# Resolve conflicts in your editor
git add .
git rebase --continue
git push origin squad/issue-slug --force
```

### "I need to update my branch with latest main"

```bash
# In your worktree
git fetch origin
git rebase origin/main
git push origin squad/issue-slug --force
```

### "How do I know if my PR is ready to merge?"

Check GitHub's PR status:
- ✅ All checks passing (green checkmarks)
- ✅ All review threads resolved
- ✅ At least one approval
- ✅ No "changes requested" (only approvals or comments)

### "I want to work on a different issue"

Just create a new worktree:

```bash
git worktree add .worktrees/918-another-task \
  -b squad/918-another-task origin/main
cd .worktrees/918-another-task
```

Multiple worktrees can coexist — each is independent.

## Team Roles & Expertise

If you're curious who to tag for review or which issues to pick up, see `.squad/team.md`:

- **Leela** — Lead, architecture, code quality
- **Fry** — Frontend, React, UI components
- **Bender** — Backend, API, harness, runtime
- **Hermes** — Testing, observability, performance
- **Zapp** — Security, auth, guardrails
- **Nibbler** — Code review, correctness, naming
- **Scribe** — Documentation, product voice, DX

## Troubleshooting

### "I see 'Your branch has diverged'"

Your branch got out of sync with main. Rebase:

```bash
git fetch origin
git rebase origin/main
git push origin squad/issue-slug --force
```

### "ESLint or vitest is failing locally"

Check for format/type issues:

```bash
npm run lint --fix      # auto-fix formatting
npm test                # run tests to see failures
npm run build           # ensure no TypeScript errors
```

### "The docs site won't build"

Check for markdown or frontmatter errors:

```bash
cd docs-site
npm run build           # see detailed error messages
npm run dev             # test locally at http://localhost:3000
```

### "I can't push to my branch"

You might need to force-push if you rebased:

```bash
git push origin squad/issue-slug --force
```

Only use `--force` if you're sure you want to overwrite the branch.

## More Information

- **Squad Ceremonies** — See `.squad/ceremonies.md` for handoff protocols
- **Decisions & ADRs** — See `.squad/decisions.md` for architecture decisions
- **Team Charter** — See `.squad/agents/{member}/charter.md` for member expertise
- **CONTRIBUTING.md** — General contribution guidelines
