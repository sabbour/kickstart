---
sidebar_position: 5
---

# Contributing with Squad

Kickstart is maintained by **Squad** — a coordinated team of AI agents supervised by a human lead. When you open an issue or want to contribute, it gets routed to the right agent based on work type. This guide explains how to work within the Squad framework and interact with our AI team.

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

## How Issues Get Routed to Squad

**The workflow:**

1. You open an issue (or the Lead opens one)
2. Lead **triages** it: assigns a `squad:{member}` label
3. That agent **picks it up** in their next session
4. Agent completes the work, following the gates below

**Example labels:**
- `squad:leela` → Leela handles this
- `squad:fry` → Fry handles this  
- `squad:copilot` → Copilot auto-routes based on capability
- `squad` (no member suffix) → Waiting for Lead triage

---

## Working with @copilot

**@copilot is a coding agent** — it can handle issues labeled `squad:copilot` if they fit one of these categories:

### 🟢 Good fit (auto-routed to @copilot)
- Bug fixes with clear reproduction steps
- Test coverage (adding missing tests, fixing flaky tests)
- Lint/format fixes and code style cleanup
- Dependency updates and version bumps
- Small isolated features with clear specs
- Documentation fixes and updates
- Changeset additions

### 🟡 Needs review (routed to @copilot, but a squad member must review the PR before merge)
- Medium features with clear specs and acceptance criteria
- Refactoring with existing test coverage
- New API endpoints following established patterns

### 🔴 Not suitable for @copilot (routed to a human squad member instead)
- Architecture decisions and system design
- Pack boundary changes
- SSE event taxonomy or A2UI contract changes
- Multi-system integration requiring coordination
- Security-critical changes (auth, encryption, guardrails)
- Performance-critical paths needing benchmarking
- Ambiguous requirements needing discussion

**If your issue has `squad:copilot`, @copilot will pick it up and follow the same gates as human agents** — see below for Design Proposal and PR Review gates.

See [`.squad/team.md`](https://github.com/azure-management-and-platforms/kickstart/blob/main/.squad/team.md) for the complete capability matrix and [`.squad/routing.md`](https://github.com/azure-management-and-platforms/kickstart/blob/main/.squad/routing.md) for the full routing table.

---

## Issue Workflow Overview

```
Issue Created → Triaged (squad:{member} label)
→ Design Proposal (comment) → Design Review (approved)
→ Create Worktree → Implementation → Tests Pass
→ Open PR → PR Review (gates) → Merge → Cleanup
```

---

## Step 1: Design Proposal (DP) — Before Any Code

**When:** Any implementation issue (except docs-only)  
**Gate:** ✅ **Blocks code** until DP is posted and approved

When you pick up an issue labeled with your name, **post a Design Proposal comment** on the issue before writing code.

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
- Leela reviews for architecture alignment with the current architecture
- Zapp reviews for security concerns (if applicable)
- Once approved, you can start implementation

**Note:** Docs-only PRs skip the DP gate and go straight to review.

---

## Step 2: Create a Worktree

**Critical:** Never use `git checkout -b` in the top-level checkout.

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

**Branch naming convention:**
```
squad/{issue-number}-{kebab-case-slug}
```

Examples:
- `squad/456-fix-empty-tool-result`
- `squad/789-add-auth-flow`

**Why worktrees?**
- Avoids dirty diffs and merge conflicts in the main checkout
- Allows multiple features to work in parallel
- Prevents accidental commits to the wrong branch

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

## Step 6: PR Review Gates

Your PR must pass **three gates before merge**:

### Gate 1: CI Status Checks

```
✅ Lint, build, unit tests
✅ Playwright E2E tests
✅ Docs gate (if you changed code)
```

**If CI fails:** Fix locally, push again. CI re-runs automatically.

### Gate 2: Code Review (Label-based)

When reviewers comment on your PR, **you must address every comment:**

1. **Read** the comment
2. **Fix** the code
3. **Reply** to the comment: `Addressed in {commit-sha}: {description}`
4. **Resolve** the thread on GitHub
5. **Push** the fix
6. **Request re-review**

**Reviewers:**
- **Leela** — Architecture alignment
- **Zapp** — Security (if touching auth, secrets, validation)
- **Nibbler** — Code quality, readability, patterns

### Gate 3: All Approval Labels

The PR cannot merge until:
- ✅ `leela:approved` label
- ✅ `zapp:approved` label (if security-sensitive paths affected)
- ✅ `nibbler:approved` label (code quality)
- ✅ All review threads resolved
- ✅ CI passing

**Docs-only PRs:** Need only `leela:approved` + `zapp:approved` labels.

---

## Step 7: Merge & Cleanup

Once all gates pass:

1. **Merge** via GitHub
2. **Delete the worktree:**
   ```bash
   cd /path/to/repo  # Go back to main checkout
   git worktree remove .worktrees/123-my-feature
   git worktree prune
   ```

---

## Local Development Setup

### Prerequisites

- **Node.js 22+**
- npm 10+

### Quick Start

```bash
# Clone the repo
git clone https://github.com/azure-management-and-platforms/kickstart.git
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

### Strict Zod Schema Requirements for Tool and Schema Files

All tool files (`packages/*/src/tools/**/*.ts`) and schema files (`packages/*/src/types/**/*.ts`) **must** use the `z-strict` wrappers instead of importing Zod directly. ESLint will error on violations at lint time.

#### Import path

```typescript
// ✅ Correct — always import from z-strict
import { z, strictOptional } from '@aks-kickstart/harness/runtime/z-strict';

// ❌ Wrong — ESLint will flag this in tool/schema files
import { z } from 'zod';
```

#### Optional fields

```typescript
// ✅ Correct — use strictOptional() which adds .nullable() automatically
const schema = z.object({
  name: z.string(),
  region: strictOptional(z.string()),  // string | null | undefined
});

// ❌ Wrong — ESLint will flag this in tool/schema files
const schema = z.object({
  name: z.string(),
  region: z.string().optional(),       // string | undefined (I2 violation)
});
```

**Why:** The OpenAI function-calling schema requires `nullable` for fields that may be absent. Using `.optional()` alone produces a schema mismatch that causes runtime I2 strict-mode violations. The `strictOptional()` wrapper ensures both `optional()` and `nullable()` are applied together.

**ESLint rules enforcing this:**
- `no-restricted-imports` — prevents `import { z } from 'zod'` in tool/schema files
- `no-restricted-syntax` — prevents `.optional()` member access in tool/schema files

These rules are enforced via the shared ESLint config. Violations are errors (not warnings) and will block CI.

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

The canonical documentation lives in **`docs-site/docs/`** and is published to [azure-management-and-platforms.github.io/kickstart](https://azure-management-and-platforms.github.io/kickstart/).

**Do not edit files in `docs/`** — that directory contains legacy redirects only. All documentation updates go to `docs-site/docs/`.

### Editing docs

- Docs are Markdown in `docs-site/docs/`
- Architecture overview: `docs-site/docs/architecture/overview.md`
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
| `docs-site/docs/architecture/overview.md` | System architecture reference |
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
