---
sidebar_position: 5
---

# Contributing with Squad

Kickstart is maintained using **Squad** — a team of AI agents coordinated by a human lead. This guide explains how features, bugs, and improvements flow through the Squad process.

## The Team

**Squad members:**
- **Leela** (Lead) — Architecture, design reviews, scope decisions, priority triage
- **Fry** (Frontend) — React, A2UI components, web client, UX
- **Bender** (Backend) — Harness runtime, packs, SDK, API, infrastructure
- **Hermes** (Tester) — Test strategy, performance, observability
- **Zapp** (Security) — Security reviews, threat modeling, guardrail design
- **Nibbler** (Code Quality) — PR reviews, readability, bug patterns
- **Scribe** (Docs & Product) — Public docs, release notes, DX
- **@copilot** (Coding Agent) — Bug fixes, tests, docs, small features (when safe)

**Which agent handles my issue?**
See [`.squad/routing.md`](https://github.com/sabbour/kickstart/blob/main/.squad/routing.md) for the complete routing table. Issues labeled `squad:{name}` are assigned to that agent.

---

## Issue Workflow Overview

```
Issue Created → Triaged (squad:member label) → Design Proposal (commented) 
→ Design Review (approved) → Implementation (in worktree) → PR Created 
→ PR Review (label gates) → Merge → Cleanup (delete worktree)
```

---

## Step 1: Understanding Your Issue

When you pick up an issue labeled `squad:{yourname}`:

1. **Read the issue body** — it contains the problem statement and acceptance criteria
2. **Check the estimate label** — `estimate:S` (2h), `estimate:M` (8h), `estimate:L` (24h), `estimate:XL` (80h)
3. **Review context links** — related ADRs, DPs, or issues
4. **Ask clarifying questions** in comments if anything is ambiguous

---

## Step 2: Design Proposal (DP)

**When:** Before you write any implementation code  
**Gate:** Blocks implementation until approved

Post a comment on the issue with:

### Design Proposal Template

```markdown
## Design Proposal

**Problem:** [1-2 sentences from the issue]

**Estimate:** S / M / L / XL  
(must match the issue's estimate label)

### Approach

[2-3 paragraphs describing your solution with reference to architecture brief]

### Pack Boundaries

- [Which packs are affected and why]

### Primitive Surface Changes

- **Tools:** [any new tool schemas or modifications]
- **User Actions:** [any new action types]
- **Components:** [any new A2UI components]

### Security Considerations

- [Trust boundaries affected?]
- [New external API calls?]
- [Secrets handling?]

### Test Strategy

- Unit: [test files added/modified]
- E2E: [Playwright coverage needed?]
- Manual: [any workflows requiring QA?]

### Docs & Changeset Plan

- **Docs:** [What gets documented?]
- **Changeset:** [Needed if user-facing?]
```

**Leela will review for:**
- ✅ Architecture alignment with the v2 implementation brief
- ✅ Pack boundaries respected
- ✅ Estimate is realistic

**For security-sensitive work, Zapp will also review.**

---

## Step 3: Create a Worktree

**Critical:** Never use `git checkout -b` in the top-level checkout.

```bash
# List existing worktrees
git worktree list

# Create a new worktree for your issue
git fetch origin
git worktree add .worktrees/123-my-feature \
  -b squad/123-my-feature-slug origin/main

# Enter the worktree
cd .worktrees/123-my-feature
```

**Branch naming:**
```
squad/{issue-number}-{kebab-case-slug}
```

Examples:
- `squad/456-fix-empty-tool-result`
- `squad/789-add-auth-flow`

**Why worktrees?**
- Avoids dirty diffs and merge conflicts in the top-level checkout
- Allows multiple features to work simultaneously
- Prevents accidental commits to the wrong branch

---

## Step 4: Implement & Test

Work normally:

```bash
# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

**Commit messages:**
- Use conventional commits: `type(scope): description (#issue)`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`
- Always reference the issue: `(#123)`

**Example:**
```bash
git commit -m "feat(harness): add phase navigation user action (#123)"
```

### Testing expectations

- Unit tests for all logic changes
- Test files live next to implementation: `runner.test.ts` next to `runner.ts`
- E2E tests for user-facing flows (Playwright)
- All tests must pass before pushing: `npm test`

---

## Step 5: Create a Changeset

**When:** Your change affects user-facing behavior  
**When NOT:** Docs-only, CI, workflow, internal refactoring

```bash
# From the worktree root
npx changeset
```

Select packages and the bump type (patch/minor/major). Changesets are committed with your branch.

---

## Step 6: Open a Pull Request

```bash
# From the worktree
git push origin squad/123-my-feature

# Create PR on GitHub with:
# Title: feat: add phase navigation user action
# Body: Closes #123
#       [Brief description]
```

---

## Step 7: PR Review Gates

Your PR must pass **three gates**:

### Gate 1: CI Status Checks

```
✅ Lint, build, unit tests
✅ Playwright E2E tests
✅ Docs gate (if you changed code)
```

**If CI fails:** Fix locally, push again, CI re-runs automatically.

### Gate 2: Code Review (Label-based)

When reviewers comment, you must **address every comment**:

1. **Read** the comment
2. **Fix** the code
3. **Reply:** `Addressed in {commit-sha}: {description}`
4. **Resolve** the thread on GitHub
5. **Push** the fix
6. **Request re-review**

**Reviewers:**
- **Leela** — Architecture alignment
- **Zapp** — Security (if touching auth, secrets, validation)
- **Nibbler** — Code quality, readability, bug patterns

**Merge gate:**
The PR cannot merge until:
- ✅ `leela:approved` label present
- ✅ `zapp:approved` label present (if sensitive paths affected)
- ✅ All comments resolved
- ✅ CI passing

**Docs-only PRs:** Need only `leela:approved` + `zapp:approved` labels.

---

## Step 8: Merge & Cleanup

Once all gates pass:

1. **Merge** via GitHub
2. **Delete the worktree:**
   ```bash
   cd /path/to/repo  # Go back to main checkout
   git worktree remove .worktrees/123-my-feature
   git worktree prune
   ```

---

## Adding New Components, Phases, or Skills

### Adding New A2UI Components

1. Define the component type in the appropriate pack's `src/components/`
2. Implement the React renderer in the pack
3. Register the component in the pack's index
4. Add documentation to `docs-site/docs/components/`

### Adding New Conversation Phases

See [Conversation Phases](./extending/conversation-phases.md) for the full guide.

In brief:
1. Add phase to the `Phase` enum in `packages/harness/src/index.ts`
2. Add `PhaseDefinition` entry with phase chaining
3. Add phase-specific skills to relevant packs
4. Test end-to-end

### Extending Agent Instructions

Agent instructions live in `.agent.md` files in `src/agents/`. Skills are `SKILL.md` files in `src/skills/`.

Guidelines:
- Keep base instructions concise — skills add domain detail
- Use `appliesTo` globs to scope skills to the right agents
- Hide Kubernetes jargon in early phases

---

## Testing

| Package | Tool | Command |
|---------|------|---------|
| `packages/harness` | Vitest | `npm run test` |
| `packages/pack-*` | Vitest | `npm run test` |
| `packages/web` | Vite | `cd packages/web && npm run build` |

Run all tests from the root:
```bash
npm run test
```

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `.squad/team.md` | Team roster, @copilot capability matrix |
| `.squad/routing.md` | Which agent handles what type of work |
| `.squad/ceremonies.md` | Design Proposal and PR Review gates in detail |
| `.squad/decisions.md` | Architecture decisions and RFCs |
| `docs-site/docs/architecture/v2-implementation-brief.md` | System design that all DPs reference |
| `.github/workflows/squad-review-gate.yml` | CI enforcing label-based approval |
| `CONTRIBUTING.md` | Local setup and development commands |

---

## Common Questions

**Issue doesn't have a `squad:{name}` label?**  
Comment asking Leela to triage it.

**Can I work on multiple issues?**  
Yes, use separate worktrees:
```bash
git worktree add .worktrees/123-a -b squad/123-a origin/main
git worktree add .worktrees/456-b -b squad/456-b origin/main
```

**My branch fell behind main?**  
Rebase in your worktree:
```bash
git fetch origin
git rebase origin/main
git push --force-with-lease origin squad/123-my-feature
```

**Do I need a DP for docs changes?**  
No. Docs PRs skip the DP gate and go straight to review.

---

## When Things Get Stuck

- **Decision needed?** Comment on the issue tagging the relevant person
- **Reviewer unresponsive?** Comment on the PR asking for re-review
- **Unsure about approach?** Post a DP draft as a question first
- **Found unrelated bug?** File a separate issue; don't bundle it

---

## Maintenance Norms

**Weekly:**
- Pulse issue posted every Monday
- Reviewers respond to PRs within 24 hours

**Monthly:**
- Docs freshness sweep (Scribe)
- Release prep (if ready)

**Per PR:**
- Design Proposal before code
- Changeset if user-facing
- Reply to all review comments
- Resolve comment threads
