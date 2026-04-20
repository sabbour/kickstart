---
sidebar_position: 5
---

# Contributing with Squad

Kickstart is maintained using **Squad** — a team of AI agents coordinated by a human lead. Squad automates much of the development workflow: issue triage, design reviews, PR reviews, and queue monitoring. This guide explains how to contribute through the **GitHub Copilot CLI** and what Squad handles automatically.

## The Squad Team

| Agent | Role | Handles |
|-------|------|---------|
| **Leela** | Lead | Architecture, design reviews, scope, priority triage |
| **Fry** | Frontend Dev | Web client, A2UI components, UX, routing |
| **Bender** | Backend Dev | Harness, packs, SDK tools, API, infrastructure |
| **Hermes** | Tester | Test strategy, performance, observability |
| **Zapp** | Security | Auth, secrets, guardrail design, security reviews |
| **Nibbler** | Code Quality | PR code review, readability, patterns |
| **Scribe** | Docs & Product | Public docs, release notes, DX, decisions |
| **@copilot** | Coding Agent | Small safe tasks: bugs, tests, docs, small features |

---

## Using Squad via GitHub Copilot CLI

The recommended way to work on Kickstart is through the **GitHub Copilot CLI**. Here's what happens at each stage:

### 1. Ralph Loop — Automatic Issue Pickup

**What it does:**
- Ralph monitors the project board for untriaged issues (labeled `squad`)
- Automatically triages them using routing rules in `.squad/routing.md`
- Assigns a `squad:{member}` label based on work type
- Posts triage comments with reasoning

**When Ralph runs:**
- **Automatically** via GitHub Actions heartbeat workflow (triggered on PR close, issue label changes)
- **Conversationally** when you ask the Copilot CLI: "Ralph, go" or "Ralph, status"
- **Persistently** via local polling: `npx @bradygaster/squad-cli watch --interval N` (checks every N minutes)

**In conversation** (e.g., with Copilot CLI or agent-based interaction):
```
You: Ralph, go
Ralph: 🔄 Scanning for untriaged issues...
[Ralph runs triage loop while work exists]

You: Ralph, status
Ralph: 📋 Found 3 untriaged issues...

You: Ralph, idle
Ralph: ⏸️ Pausing. Use `npx @bradygaster/squad-cli watch --interval 10` for persistent polling.
```

For continuous monitoring without conversation:
```bash
# Polls GitHub every 10 minutes (default)
npx @bradygaster/squad-cli watch

# Custom interval
npx @bradygaster/squad-cli watch --interval 5
```

**What you don't need to do:** Manually triage issues or assign labels. Ralph does this automatically.

### 2. Automatic Design Review Gates

When a squad member picks up an issue labeled `squad:{name}` and posts a Design Proposal comment:
- **Leela** (Lead) automatically reviews for architecture alignment
- **Zapp** reviews for security concerns if relevant
- Design Review happens in parallel — no human coordination needed

**What you need to do:** Post the Design Proposal comment (template provided below).  
**What Squad handles:** Review assignment, feedback, approval decisions.

### 3. Automatic PR Review Gates

When you open a PR from your worktree:
- **CI** automatically runs lint, tests, and builds
- **Nibbler** reviews for code quality
- **Leela** reviews for architecture
- **Zapp** reviews for security if touching sensitive paths
- All reviews use label-based approval gates (see Step 6 below for exact labels)

**What you need to do:** Address feedback with required comment replies.  
**What Squad handles:** Review assignment, parallel review, merge blocking until gates pass.

### 4. Worktree Pattern — Standardized by Squad

Squad enforces a standardized worktree pattern (rather than manual `git checkout -b` in the top-level checkout):

**What you do:**
```bash
# Create a worktree for your issue
git worktree add .worktrees/123-my-feature -b squad/123-my-feature origin/main
cd .worktrees/123-my-feature
```

**What Squad standardizes:** Requires all work to use isolated worktrees, preventing dirty diffs, merge conflicts in the main checkout, and accidental commits to the wrong branch.

---

## Working with Copilot CLI

The **GitHub Copilot CLI** is your interface to Squad. It:
- Manages workflow bookkeeping
- Enforces ceremony gates (DP, PR review)
- Integrates with Ralph for queue monitoring
- Handles repetitive task coordination

### When @copilot auto-handles an issue

Issues labeled `squad:copilot` get picked up by the coding agent if they fit one of these categories:

**🟢 Good fit (auto-routed)**
- Bug fixes with clear reproduction steps
- Test coverage (adding missing tests, fixing flaky tests)
- Lint/format fixes and code style cleanup
- Dependency updates and version bumps
- Small isolated features with clear specs
- Documentation fixes and updates
- Changeset additions

**🟡 Needs review (routed to @copilot, but a squad member must review the PR)**
- Medium features with clear specs and acceptance criteria
- Refactoring with existing test coverage
- New API endpoints following established patterns

**🔴 Not suitable for @copilot (routed to a human squad member)**
- Architecture decisions and system design
- Pack boundary changes
- SSE event taxonomy or A2UI contract changes
- Multi-system integration requiring coordination
- Security-critical changes (auth, encryption, guardrails)
- Performance-critical paths needing benchmarking
- Ambiguous requirements needing discussion

See [`.squad/team.md`](https://github.com/sabbour/kickstart/blob/main/.squad/team.md) for the complete capability matrix and [`.squad/routing.md`](https://github.com/sabbour/kickstart/blob/main/.squad/routing.md) for the full routing table.

---

## Issue Workflow — What You Do vs What Squad Handles

```
Untriaged Issue (squad label)
  ↓
Ralph auto-triages → assigns squad:{member} label
  ↓
You (assigned agent) pick up the issue
  ↓
You create worktree (one-time setup)
  ↓
You write Design Proposal comment (DP gate)
  ↓
Leela + Squad review automatically (no manual coordination)
  ↓
You implement in worktree + commit + push
  ↓
You open PR
  ↓
CI + Nibbler + Leela + Zapp review automatically (label-based gates)
  ↓
You address feedback with reply comments (required)
  ↓
Merge when all gates pass (automatic via CI)
  ↓
You delete worktree (cleanup)
```

**What You Do:**
- Write code
- Post Design Proposal and PR comments
- Reply to review feedback
- Test locally before pushing
- Manage your worktree lifecycle

**What Ralph + Squad Handle:**
- Triage and issue assignment
- Design review assignment and approval
- PR review assignment and approval
- Merge eligibility checking
- Continuous queue monitoring (Ralph)
- Ceremony gate enforcement (via CI labels)

---

## Step 1: Design Proposal (DP) — Before Any Code

**When:** Any implementation issue (except docs-only)  
**Gate:** ✅ **Blocks code** until DP is posted and approved by Squad

### What You Do

Post a comment on the issue with the Design Proposal template below. Include your proposed approach, affected packs, security considerations, and test strategy.

### What Squad Handles Automatically

After you post the DP:
1. **Leela** is notified and reviews for architecture alignment with the [v2 implementation brief](./architecture/v2-implementation-brief.md)
2. **Zapp** reviews for security concerns if applicable
3. Once both approve (via comments), you can start implementation
4. No manual ceremony coordination needed — it happens in parallel

### Design Proposal Template

```markdown
## Design Proposal

**Problem:** [1-2 sentences from the issue]

**Estimate:** S / M / L / XL  
(must match the issue's `estimate:*` label)

### Approach

[2-3 paragraphs describing your solution, referencing the architecture brief]

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

- **Unit:** [test files to add/modify]
- **E2E:** [Playwright coverage needed?]
- **Manual:** [any workflows requiring QA?]

### Docs & Changeset Plan

- **Docs:** [What gets documented?]
- **Changeset:** [User-facing = needs changeset]
```

**Review process:**
- Leela reviews for architecture alignment with the [v2 implementation brief](./architecture/v2-implementation-brief.md)
- Zapp reviews for security concerns (if applicable)
- Once approved, you can start implementation

**Note:** Docs-only PRs skip the DP gate and go straight to review.

---

## Step 2: Create a Worktree

**Critical:** Never use `git checkout -b` in the top-level checkout. Squad enforces isolated worktrees to prevent dirty diffs and branch conflicts.

```bash
# List existing worktrees
git worktree list

# Fetch latest
git fetch origin

# Create a new worktree for your issue
git worktree add .worktrees/123-my-feature \
  -b squad/123-my-feature-slug origin/main

# Enter the worktree
cd .worktrees/123-my-feature
```

**Branch naming convention:** `squad/{issue-number}-{kebab-case-slug}`

Examples:
- `squad/456-fix-empty-tool-result`
- `squad/789-add-auth-flow`

**Why worktrees?**
- Avoids dirty diffs and merge conflicts in the main checkout
- Allows multiple features to work in parallel
- Prevents accidental commits to the wrong branch
- Matches the Squad workflow model

---

## Step 3: Implement & Test

Work normally within your worktree:

```bash
# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

**Commit messages** follow conventional commits:
```bash
git commit -m "feat(harness): add phase navigation action (#123)"
```

Format: `type(scope): description (#issue)`  
Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`

**Testing expectations:**
- Unit tests for all logic changes
- Test files live next to implementation: `runner.test.ts` next to `runner.ts`
- E2E tests for user-facing flows (Playwright)
- All tests must pass: `npm test`

---

## Step 4: Create a Changeset

**When:** Your change affects user-facing behavior  
**When NOT:** Docs-only, CI, workflows, internal refactoring

From the worktree root:

```bash
npx changeset
```

Select packages and the bump type (patch/minor/major). Changesets are committed with your branch.

---

## Step 5: Open a Pull Request

```bash
# From the worktree
git push origin squad/123-my-feature

# Create PR on GitHub
# Title: feat: add phase navigation action
# Body: Closes #123
#       [Brief description of changes]
```

---

## Step 6: PR Review Gates — What Squad Handles

Your PR automatically goes through **three gates**:

### Gate 1: CI Status Checks (Automatic)

```
✅ Lint, build, unit tests
✅ Playwright E2E tests
✅ Docs gate (if you changed code)
```

Squad's CI pipeline runs automatically. **If CI fails:** Fix locally, push again. CI re-runs automatically.

### Gate 2: Code Review (Automatic Assignment + Your Response)

**Squad assigns reviewers automatically:**
- **Leela** — Architecture alignment
- **Zapp** — Security (if touching auth, secrets, validation)
- **Nibbler** — Code quality, readability, patterns (may review but does not block merge)

**What you must do:** Address every comment with a required response format:

1. **Read** the comment
2. **Fix** the code
3. **Reply** to the comment: `Addressed in {commit-sha}: {description}`
4. **Resolve** the thread on GitHub
5. **Push** the fix
6. **Request re-review**

### Gate 3: Approval Labels (Enforced by Squad)

The PR cannot merge until:
- ✅ `leela:approved` label (always required)
- ✅ `zapp:approved` label (required if code touches security-sensitive paths: auth, secrets, CORS, validation)
- ✅ All review threads resolved
- ✅ CI passing

**Label enforcement is automated by `.github/workflows/squad-review-gate.yml` and `.github/workflows/squad-auto-merge.yml`.**

**Docs-only PRs:** Need only `leela:approved` label.

**What Squad handles:** Checking label presence, blocking merge until all gates pass, CI integration.  
**What you handle:** Addressing feedback comments with required replies.

---

## Step 7: Merge & Cleanup

Once all gates pass:

1. **Merge** via GitHub (automatic merge may be enabled via CI)
2. **Delete the worktree:**
   ```bash
   cd /path/to/repo  # Go back to main checkout
   git worktree remove .worktrees/123-my-feature
   git worktree prune
   ```

**What Squad handles:** Merge eligibility verification, preventing manual merge without all gates passing.  
**What you handle:** Cleanup of your worktree once merged.

---

## Local Development Setup

### Prerequisites

- **Node.js 22+**
- npm 10+

### Quick Start

```bash
# Clone the repo
git clone https://github.com/sabbour/kickstart.git
cd kickstart

# Install dependencies
npm install

# Build all packages
npm run build

# Start dev server
npm run dev
```

- **http://localhost:4280** — Full stack (SWA CLI: frontend + API)
- **http://localhost:5173** — Vite dev server (frontend only, demo mode)

### Project Structure

```
packages/
  harness/        Core conversation engine
  pack-core/      Core skills and tools
  pack-azure/     Azure-specific skills
  pack-aks-automatic/  AKS Automatic skills
  pack-github/    GitHub integration skills
  web/            React frontend (Fluent UI v9, Vite)
infra/            Azure infrastructure (Bicep)
docs-site/        Public documentation (Docusaurus)
.squad/           Team configuration, decisions, charters
```

### Build & Test Commands

```bash
# Build all packages
npm run build

# Run all tests
npm test

# Lint
npm run lint

# Run dev server with hot reload
npm run dev

# Build docs site locally
cd docs-site && npm install && npm start
```

---

## Adding New A2UI Components

To add a component to the Kickstart catalog:

1. Define the component type and data model in the appropriate pack's `src/components/`
2. Implement the React renderer (basic or rich) in the pack
3. Register the component contribution in the pack's index
4. Add documentation to `docs-site/docs/components/`

---

## Adding New Conversation Phases

See [Conversation Phases](./extending/conversation-phases.md) for the full walkthrough.

In brief:
1. Add a new phase to the `Phase` enum in `packages/harness/src/types/`
2. Add a `PhaseDefinition` entry with `nextPhase` chaining
3. Add phase-specific skills to relevant packs
4. Test the flow end-to-end

---

## Extending Agent Instructions

Agent instructions live in `.agent.md` files inside each pack's `src/agents/` directory. Skills are `SKILL.md` files in `src/skills/`. Key guidelines:

- Keep agent base instructions concise — skills add the domain detail
- Use `appliesTo` globs to scope skills to the right agents
- Hide Kubernetes jargon in early phases (Discover, Design)

---

## Documentation

The canonical documentation lives in **`docs-site/docs/`** and is published to [sabbour.github.io/kickstart](https://sabbour.github.io/kickstart/).

**Do not edit files in `docs/`** — that directory contains legacy redirects only. All documentation updates go to `docs-site/docs/`.

### Editing docs

- Docs are Markdown in `docs-site/docs/`
- Architecture brief: `docs-site/docs/architecture/v2-implementation-brief.md`
- Run the site locally: `cd docs-site && npm install && npm start`
- New pages are auto-added to the sidebar based on `sidebar_position` frontmatter

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `.squad/team.md` | Team roster, @copilot capability matrix |
| `.squad/routing.md` | Work routing: who handles what type |
| `.squad/ceremonies.md` | Design Proposal and PR Review gates |
| `.squad/decisions.md` | Architecture decisions and RFCs |
| `docs-site/docs/architecture/v2-implementation-brief.md` | System design that all DPs reference |
| `.github/workflows/squad-review-gate.yml` | CI enforcing label-based approval |
| `CONTRIBUTING.md` | (Local repo) Setup and development commands |

---

## Troubleshooting & Common Questions

**Issue doesn't have a `squad:{name}` label?**  
Comment asking Leela to triage it.

**Can I work on multiple issues simultaneously?**  
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

**Do I need a Design Proposal for docs-only changes?**  
No. Docs PRs skip the DP gate and go straight to review.

**What if a reviewer is unresponsive?**  
Comment on the PR asking for re-review. If still stuck after 24h, escalate to the Lead.

**Found an unrelated bug while working?**  
File a separate issue; don't bundle it with your PR.

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
- Resolve all comment threads before merge

---

## Maintaining Copilot Skills

Kickstart maintains a suite of Copilot CLI skills under `.copilot/skills/`. For a quick reference on existing skills, their use cases, and authoring conventions, see [`.copilot/skills/README.md`](./.copilot/skills/README.md).
