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
  harness/              @kickstart/harness — runtime engine (Runner, pack registry, session, SSE)
  pack-core/            @kickstart/pack-core — base agents, skills, tools, components
  pack-azure/           @kickstart/pack-azure — Azure-specific agents, tools, auth
  pack-aks-automatic/   @kickstart/pack-aks-automatic — AKS Automatic deployment pack
  pack-github/          @kickstart/pack-github — GitHub agents, tools, OAuth
  web/                  @kickstart/web — React 19 frontend + Azure Functions API
  mcp-server/           @kickstart/mcp-server — MCP adapter for IDE integration
infra/                  Azure infrastructure (Bicep templates)
```

| Package | Description |
|---------|-------------|
| `@kickstart/harness` | Domain-agnostic runtime: Runner, pack registry, session management, SSE streaming, skill resolver, guardrail engine |
| `@kickstart/pack-core` | Base agents (triage, codesmith, reviewer), core tools (emit_ui, write_file), A2UI catalog, guardrails |
| `@kickstart/pack-azure` | Azure authentication, ARM API tools, resource pickers, smart components (login, resource picker, cost estimator) |
| `@kickstart/pack-aks-automatic` | AKS Automatic deployment agents, manifests, cluster configuration |
| `@kickstart/pack-github` | GitHub authentication, repo/PR tools, smart components (login, repo picker, commit UI) |
| `@kickstart/web` | React 19 SPA frontend with Fluent UI 2, Azure Functions backend, A2UI renderer, virtual file system |
| `@kickstart/mcp-server` | MCP (Model Context Protocol) adapter for VS Code Copilot and Claude Code |

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

Kickstart uses **Squad** — a team of AI agents coordinated by a human lead. The canonical guide for contributing is in **[docs-site/docs/contributing.md](https://sabbour.github.io/kickstart/docs/contributing/)**, which explains:

- **Ralph loop** for automatic issue triage and queue monitoring
- **Design Proposal gates** enforced by Squad
- **PR review gates** with automatic reviewer assignment
- **Worktree workflow** for isolated feature branches
- **Squad vs. manual** — what you do vs. what's automated

This file contains setup instructions only. For workflow details, see the canonical guide above.

### Team Structure & Issue Routing

See `.squad/team.md` and the [canonical contributing guide](https://sabbour.github.io/kickstart/docs/contributing/) for full details.

### Picking Up a Feature or Bug

**Canonical workflow steps:** See [Contributing with Squad](https://sabbour.github.io/kickstart/docs/contributing/).

Quick reference:
1. Wait for Ralph or Leela to assign a `squad:{member}` label (automatic triage via Ralph heartbeat)
2. Create a worktree: `git worktree add .worktrees/{issue}-{slug} -b squad/{issue}-{slug} origin/main`
3. Post a Design Proposal comment (DP gate blocks code)
4. Implement → Commit → Push → Open PR
5. Address review feedback (required comment replies)
6. Merge when all gates pass
7. Delete worktree: `git worktree remove .worktrees/{issue}-{slug}`

**For full step-by-step instructions with examples, templates, and rationale, see the [canonical guide](https://sabbour.github.io/kickstart/docs/contributing/).**

### Key Conventions for Safe Contribution

See the [canonical guide](https://sabbour.github.io/kickstart/docs/contributing/) for detailed explanations. Quick reference:

**Branches:** Always `.worktrees/{issue-slug}` with `squad/{issue}-{slug}` branch naming — never `git checkout -b` in top-level.

**Commits:** Conventional format `type(scope): description (#issue)` with issue reference in PR body.

**Changesets:** `npx changeset` for all user-facing changes. Skip for docs-only, CI, workflows.

**Docs:** Public docs in `docs-site/docs/` only. Update architecture briefs for harness changes.

**PR workflow:** DP gate before code. Focused PRs. Local lint + test before push. Reply to all review comments with required protocol.

**Code review:** Reply to comments: `Addressed in {sha}: {description}`. Resolve thread. Request re-review. Never merge your own.

### Example: Contributing a Bug Fix

See the [canonical guide](https://sabbour.github.io/kickstart/docs/contributing/) for complete examples with all steps.

Quick example:
```bash
# 1. Ralph auto-triages issue #456 → assigns squad/bender label
# 2. Create worktree
git worktree add .worktrees/456-runner-fix -b squad/456-runner-fix origin/main
cd .worktrees/456-runner-fix

# 3. Fix the bug locally
npm test packages/harness
# ... edit and test ...

# 4. Commit and push
git commit -m "fix(harness): handle empty tool result in Runner (#456)"
git push origin squad/456-runner-fix

# 5. Open PR → DP (if needed) → Review → Merge → Cleanup
```

### When to Ask for Help

See the [canonical guide FAQ](https://sabbour.github.io/kickstart/docs/contributing/#troubleshooting--common-questions) for common questions and troubleshooting.

Quick reference:
- **Unclear acceptance criteria?** → Comment on issue; Leela will clarify
- **Blocked on decision?** → Comment on issue
- **Unsure about architecture?** → Mention Leela
- **Security concern?** → Mention Zapp
- **Not sure who owns this?** → Check `.squad/routing.md`

---

## Squad Ceremony Gates

The workflow is enforced by ceremony gates. See `.squad/ceremonies.md` for complete details on:
- **Design Proposal gate** — blocks code until DP approved
- **Design Review gate** — blocks code until all reviewers approve
- **PR Review gate** — blocks merge until all labels present and threads resolved

See also: [Contributing with Squad](https://sabbour.github.io/kickstart/docs/contributing/)

## Infrastructure

Azure infrastructure lives in `infra/` and uses Bicep. See the [Deployment Guide](https://sabbour.github.io/kickstart/docs/getting-started/deployment) for full details.
