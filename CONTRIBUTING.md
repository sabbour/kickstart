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

## Contributing with Squad

Kickstart uses **Squad** — a team of AI agents coordinated by a human lead.

**For the complete workflow guide, ceremonies, troubleshooting, and examples, see [Contributing with Squad](https://sabbour.github.io/kickstart/docs/contributing/).**

Quick local references:
- **Team roster & issue routing:** `.squad/team.md`
- **Ceremony gates (DP, Review, PR gates):** `.squad/ceremonies.md`
- **Decisions log:** `.squad/decisions/`
- **Agent charters:** `.squad/agents/{member}/charter.md`

### Maintaining Skills

Skills are authored as `.copilot/skills/{skill}/SKILL.md` files (agentskills.io format). See `.copilot/skills/README.md` for guidance on skill structure, patterns, and maintenance.

## Infrastructure

Azure infrastructure lives in `infra/` and uses Bicep. See the [Deployment Guide](https://sabbour.github.io/kickstart/docs/getting-started/deployment) for full details.
