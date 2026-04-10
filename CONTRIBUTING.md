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

# Start the web frontend
npx serve packages/web -l 4280
```

Open [http://localhost:4280](http://localhost:4280) to view the app.

## Project Structure

```
packages/
  core/           Core conversation engine, A2UI catalog, and code generators
  web/            Web frontend — Azure Portal-style UX
  mcp-server/     MCP server exposing conversation tools and A2UI responses
infra/            Azure infrastructure (Bicep templates)
```

| Package | Description |
|---------|-------------|
| `@kickstart/core` | Conversation engine, A2UI component catalog, code generators |
| `@kickstart/web` | Static frontend — HTML/CSS/JS portal-style UI |
| `@kickstart/mcp-server` | Model Context Protocol server for tool integration |

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

Before merging a feature or fix branch, create a changeset to document changes for the next release:

```bash
npx changeset add
```

Follow the prompts to select which packages changed and the type of bump (major, minor, patch). Changesets are stored in `.changeset/` and are committed with your branch. When the maintainer is ready to cut a release, they'll run `changeset version` to bump versions and collate changes into CHANGELOG.md.

### Key Entry Points

- **Web UI:** `packages/web/index.html`
- **Engine phases:** `packages/core/src/engine/phases.ts`
- **MCP server:** `packages/mcp-server/src/index.ts`

## Code Style

- TypeScript throughout (ESLint enforced)
- `editor.formatOnSave` is enabled in the devcontainer
- Follow existing patterns in the codebase

## Infrastructure

Azure infrastructure lives in `infra/` and uses Bicep. See `infra/README.md` for deployment details.
