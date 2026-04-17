# Contributing to Kickstart

Thanks for your interest in Kickstart — the AI-guided onboarding experience for deploying apps to AKS.

## Quick Start with Codespaces

The fastest way to get started is GitHub Codespaces. Click the button below to open a fully configured environment:

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new?quickstart=1)

The Codespace will automatically install dependencies, build the project, and start the dev server on **port 4280**.

## Running Locally

### Prerequisites

- **Node.js 20+** (22 recommended)
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

```
packages/
  core/           Core conversation engine, A2UI catalog, and code generators
  web/            Web frontend — Azure Portal-style UX
  web/api/        Azure Functions backend (converse, health, proxies)
  mcp-server/     MCP server exposing conversation tools and A2UI responses
infra/            Azure infrastructure (Bicep templates)
```

| Package | Description |
|---------|-------------|
| `@kickstart/core` | Conversation engine, A2UI component catalog, code generators |
| `@kickstart/web` | React 19 frontend with Fluent UI 2, Vite 6 dev server |
| `@kickstart/web` (api) | Azure Functions backend; uses OpenAI Agents SDK for route management |
| `@kickstart/mcp-server` | Model Context Protocol server for tool integration |

### Conversation engine

The conversation engine uses the **OpenAI Agents SDK** (migrated in #330/#445). The previous TypeScript state machine (`machine.ts`) and `phaseComplete`/`filesComplete` model flags were removed. Route management is now server-authored via the SDK — see [Architecture Overview](https://sabbour.github.io/kickstart/docs/architecture/overview) for current details.

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

- **Web UI:** `packages/web/index.html`
- **Engine phases:** `packages/core/src/engine/phases.ts`
- **Agents SDK backend:** `packages/web/api/src/functions/converse.ts`
- **MCP server:** `packages/mcp-server/src/index.ts`

## Code Style

- TypeScript throughout (ESLint enforced)
- `editor.formatOnSave` is enabled in the devcontainer
- Follow existing patterns in the codebase

## Documentation

The canonical documentation lives in **`docs-site/docs/`** and is published to [sabbour.github.io/kickstart](https://sabbour.github.io/kickstart/). This is the single source of truth.

**Do not edit files in `docs/`** — that directory contains redirect stubs only. All documentation updates go to `docs-site/docs/`.

### Editing docs

- Docs are Markdown files in `docs-site/docs/`
- Run the site locally: `cd docs-site && npm install && npm start`
- New pages are auto-added to the sidebar based on directory structure and `sidebar_position` frontmatter

## Infrastructure

Azure infrastructure lives in `infra/` and uses Bicep. See the [Deployment Guide](https://sabbour.github.io/kickstart/docs/getting-started/deployment) for full details.
