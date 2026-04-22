# Contributing to Kickstart

Thanks for your interest in Kickstart — the AI-guided onboarding experience for deploying apps to AKS.

## Quick Start with Codespaces

The fastest way to get started is GitHub Codespaces. Click the button below to open a fully configured environment:

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new?quickstart=1)

The Codespace will automatically install dependencies, build the project, and start the dev server on **port 4280**.

## Running Locally

### Prerequisites

- **Node.js 22+**
- npm 10+

### Setup

```bash
# Clone the repo
git clone <repo-url>
cd kickstart

# Install dependencies
npm install

# Build all packages
npm run build

# Start full-stack dev server (Vite + SWA CLI)
npm run dev

# Or frontend only (fast, no API needed)
npm run dev:vite
```

- **http://localhost:4280** — Full app (SWA CLI: frontend + API)
- **http://localhost:5173** — Vite dev server (HMR, frontend only, demo mode)

## Project Structure

Kickstart v2 uses a **harness + packs architecture**. The harness is domain-agnostic; packs carry all product knowledge.

```
packages/
  harness/              @aks-kickstart/harness — runtime engine (Runner, pack registry, session, SSE)
  pack-core/            @aks-kickstart/pack-core — base agents, skills, tools, components
  pack-azure/           @aks-kickstart/pack-azure — Azure-specific agents, tools, auth
  pack-aks-automatic/   @aks-kickstart/pack-aks-automatic — AKS Automatic deployment pack
  pack-github/          @aks-kickstart/pack-github — GitHub agents, tools, OAuth
  web/                  @aks-kickstart/web — React 19 frontend + Azure Functions API
  mcp-server/           @aks-kickstart/mcp-server — MCP adapter for IDE integration
infra/                  Azure infrastructure (Bicep templates)
```

| Package | Description |
|---------|-------------|
| `@aks-kickstart/harness` | Domain-agnostic runtime: Runner, pack registry, session management, SSE streaming, skill resolver, guardrail engine |
| `@aks-kickstart/pack-core` | Base agents (triage, codesmith, reviewer), core tools (emit_ui, write_file), A2UI catalog, guardrails |
| `@aks-kickstart/pack-azure` | Azure authentication, ARM API tools, resource pickers, smart components (login, resource picker, cost estimator) |
| `@aks-kickstart/pack-aks-automatic` | AKS Automatic deployment agents, manifests, cluster configuration |
| `@aks-kickstart/pack-github` | GitHub authentication, repo/PR tools, smart components (login, repo picker, commit UI) |
| `@aks-kickstart/web` | React 19 SPA frontend with Fluent UI 2, Azure Functions backend, A2UI renderer, virtual file system |
| `@aks-kickstart/mcp-server` | MCP (Model Context Protocol) adapter for VS Code Copilot and Claude Code |

## Development Workflow

```bash
# Build all packages
npm run build

# Lint
npm run lint

# Run tests
npm test
```

### Creating a Changeset

Every PR that changes user-facing behavior should include a changeset:

```bash
npx changeset
```

Follow the prompts to select which packages changed and the bump type (patch for fixes, minor for features). Changesets are stored in `.changeset/` and committed with your branch.

For the full release workflow — cutting releases, tagging, deploying — see **[RELEASING.md](RELEASING.md)**.

### Key Entry Points

- **Web UI:** `packages/web/src/main.tsx` (React app entrypoint)
- **Web API:** `packages/web/api/src/functions/` (Azure Functions: converse, resume, packs manifest)
- **Harness runtime:** `packages/harness/src/runtime/runner.ts` (Runner, SSE streaming)
- **Phase definitions:** `packages/harness/src/index.ts` (Phase enum and phase metadata)
- **Pack structure:** `packages/pack-core/src/index.ts` (example: core pack manifests agents, tools, components)
- **MCP server:** `packages/mcp-server/src/index.ts` (MCP adapter for IDE clients)

## Code Style

- TypeScript throughout (ESLint enforced)
- `editor.formatOnSave` is enabled in the devcontainer
- Follow existing patterns in the codebase

## Documentation

The canonical documentation lives in **`docs-site/docs/`** and is published to [sabbour.github.io/kickstart](https://sabbour.github.io/kickstart/). This is the single source of truth.

**Do not edit files in `docs/`** — that directory contains the redirect map only. All documentation updates go to `docs-site/docs/`.

### Editing docs

- Docs are Markdown files in `docs-site/docs/`
- The architecture brief lives at `docs-site/docs/architecture/v2-implementation-brief.md`
- `docs/README.md` is the redirect map for removed legacy `docs/*` paths
- Run the site locally: `cd docs-site && npm install && npm start`
- New pages are auto-added to the sidebar based on directory structure and `sidebar_position` frontmatter

## Squad Workflow — Maintaining with AI Agents

Kickstart uses **Squad** — a team of AI agents (Leela, Fry, Bender, Hermes, Zapp, Nibbler, Scribe) coordinated by a human or automated lead. If you're contributing to Kickstart or maintaining it, you'll interact with these conventions.

### Team Structure & Issue Routing

**See:** `.squad/team.md` (team roster and routing rules)

The Squad consists of:
- **Leela** (Lead) — Architecture, design proposals, scope decisions
- **Fry** (Frontend) — React, A2UI, web client
- **Bender** (Backend) — Harness, packs, API, infrastructure
- **Hermes** (Testing) — Test strategy, performance, observability
- **Zapp** (Security) — Security review, threat modeling, guardrail design
- **Nibbler** (Code Quality) — PR reviews, readability, bug patterns
- **Scribe** (Docs & Product) — Public docs, release notes, DX review

Issues labeled `squad` are triaged by the Lead, who assigns the appropriate team member with a `squad:{member}` label. Each member has a **charter** describing their domain and responsibilities.

**Coding Agent (@copilot)** can auto-handle bugs, tests, docs, and small isolated features (see `.squad/team.md` for the capability matrix). For complex work, a squad member takes it.

### Picking Up a Feature or Bug

1. **Find an unstarted issue** on the [project board](https://github.com/users/sabbour/projects/3) with a `squad:{member}` label
2. **No label yet?** The issue has the base `squad` label. It's untriaged — Leela will assign it when available
3. **If labeled with your name:** That's your work. Read the issue body and acceptance criteria
4. **Design Proposal gate:** Before implementing, you (or the assigned agent) post a **Design Proposal** comment on the issue explaining the approach, affected packs, test strategy, and docs plan. Leela reviews it before you code
5. **Worktree workflow:** Create a feature branch in a **dedicated worktree**, not in the top-level checkout:
   ```bash
   git fetch origin
   git worktree list                    # check what's in flight
   git worktree add .worktrees/123-my-feature \
     -b squad/123-my-feature origin/main
   cd .worktrees/123-my-feature
   ```
   Every issue gets its own worktree to avoid dirty diffs and branch conflicts.
6. **Commit with issue reference:** `git commit -m "feat: add auth flow (#123)"`
7. **Changeset:** If user-facing, add a changeset: `npx changeset`
8. **PR creation:** Open PR from your branch to `main`. Mention issue in description: `Closes #123`
9. **PR review gates:**
   - **Nibbler** reviews for code quality, readability, bugs
   - **Leela** reviews for architecture alignment
   - **Zapp** reviews if security-sensitive (auth, secrets, CORS, validation)
   - **CI must pass** before merge
10. **Address feedback:** If reviewers request changes, post an acknowledgment comment, fix the code, push, and request re-review
11. **Merge & cleanup:** Once approved, the PR merges. Delete your worktree:
    ```bash
    git worktree remove .worktrees/123-my-feature
    git worktree prune
    ```

### Key Conventions for Safe Contribution

**Branches:**
- Always use `.worktrees/{issue-number}-{slug}` — never `git checkout -b` in the top-level directory
- Branch naming: `squad/123-my-feature-slug`

**Commits:**
- Reference issue number: `Closes #123` in PR description
- Use conventional commit format: `type(scope): description (#issue)`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`

**Changesets** (every user-facing change):
- Run `npx changeset` after implementing a feature or fix
- Skip changesets for: docs-only PRs, CI/workflow changes, dev tool changes
- See [RELEASING.md](RELEASING.md) for versioning rules

**Docs & DX:**
- Public docs live in `docs-site/docs/`, not `docs/`
- Update architecture briefs if you change harness primitives (tools, agents, components, etc.)
- If adding an extension point, document it in `docs-site/docs/extending/`

**PR Workflow:**
- Design Proposal posts before code (required by ceremony gate)
- Aim for focused PRs (one issue per PR — split large features into sub-issues)
- Code must pass `npm run lint` and `npm test` locally before pushing
- CI must pass: linting, unit tests, E2E tests
- If flagged as 🟡 **needs review**, note it in the PR body and wait for squad member approval

**Code Review Protocol:**
- Reviewers will comment on the PR; address all comments
- Reply to each comment with what you did: e.g., "Addressed in {commit-sha}: {description}"
- After pushing fixes, request re-review
- Never merge your own PR

### Example: Contributing a Bug Fix

```bash
# 1. Find an issue labeled squad/bender (backend bug)
# Issue: #456 — "ConvocationRunner fails on empty tool result"

# 2. Create worktree
git worktree add .worktrees/456-runner-empty-tool \
  -b squad/456-runner-empty-tool origin/main
cd .worktrees/456-runner-empty-tool

# 3. Reproduce and fix
npm test packages/harness               # Find the failing test
# ... edit packages/harness/src/runner.ts to handle empty tool result ...
npm test                               # Verify all tests pass

# 4. Commit
git commit -m "fix(harness): handle empty tool result in Runner (#456)"

# 5. Push
git push origin squad/456-runner-empty-tool

# 6. Create PR
# Go to GitHub, create PR with title "fix: handle empty tool result in Runner"
# In description: "Closes #456"

# 7. Address any feedback from reviewers

# 8. Once approved and merged
git worktree remove .worktrees/456-runner-empty-tool
git worktree prune
```

### When to Ask for Help

- **Not sure which squad member owns this?** → Check `.squad/routing.md`
- **Unclear acceptance criteria?** → Comment on the issue; Leela will clarify
- **Blocked on a decision?** → Comment on the issue with your question; don't spin
- **Architecture question?** → Ask in the issue or reach out to Leela
- **Security concern?** → Mention Zapp (`@zapp`) for a security review

### Squad Documentation

**Canonical Squad reference:**
- `.squad/team.md` — Team roster, routing rules, @copilot capability matrix
- `.squad/routing.md` — Decision tree for routing work to the right person
- `.squad/issue-lifecycle.md` — Detailed issue → branch → PR → merge workflow with command examples
- `.squad/ceremonies.md` — Design Proposal, Design Review, PR Review gates
- `.squad/decisions.md` — Team decisions, RFCs, architecture notes

These are living documents. If you find workflows unclear or outdated, file an issue or note it in Scribe's decision inbox.

## Infrastructure

Azure infrastructure lives in `infra/` and uses Bicep. See the [Deployment Guide](https://sabbour.github.io/kickstart/docs/getting-started/deployment) for full details.
