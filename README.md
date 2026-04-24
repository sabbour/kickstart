[![CI](https://github.com/azure-management-and-platforms/kickstart/actions/workflows/ci.yml/badge.svg?branch=dev&event=push)](https://github.com/azure-management-and-platforms/kickstart/actions/workflows/ci.yml)

[![Deployment](https://github.com/azure-management-and-platforms/kickstart/actions/workflows/deploy-swa.yml/badge.svg?branch=dev&event=push)](https://github.com/azure-management-and-platforms/kickstart/actions/workflows/deploy-swa.yml)

# Kickstart

**AI-guided onboarding for deploying apps to AKS Automatic.**

Kickstart helps developers go from "I have an app" to "it's running on Azure" through a guided conversation. It frames AKS Automatic as a scalable app platform — no Kubernetes knowledge required.

🌐 **Live app:** [kickstart.aks.azure.sabbour.me](https://kickstart.aks.azure.sabbour.me)
📖 **Docs:** [sabbour.github.io/kickstart](https://sabbour.github.io/kickstart/)
🎮 **Playground:** [/?playground](https://kickstart.aks.azure.sabbour.me/?playground) — Explore the A2UI component library and demo scenarios

## Features

- **Harness + packs architecture** — domain-agnostic runtime (`@kickstart/harness`) + domain packs (`pack-core`, `pack-azure`, `pack-aks-automatic`, `pack-github`)
- **A2UI component system** — Fluent UI 2 styled components rendered from structured JSON emitted by agents via `core.emit_ui`
- **Component playground** — Interactive demo surface for exploring A2UI components, scenarios, and questionnaire flows
- **Azure and GitHub integration** — Login cards, resource pickers, and action buttons with real API integration via UserAction pause/resume
- **`@openai/agents` SDK** — Agents call tools; UserActions pause the runner for browser-side interactions (MSAL popup, GitHub OAuth, etc.)
- **Guardrails engine** — Cross-cutting checks at input, tool-call, and output stages contributed by packs
- **MCP server** — IDE integration for VS Code Copilot and Claude Code via `@kickstart/mcp-server`
- **Monorepo** — `packages/harness` (runtime), `packages/pack-*` (domain packs), `packages/web` (React 19 + Vite 6), `packages/mcp-server`

## Two Surfaces, One Harness

| Surface | How it works | LLM |
|---------|-------------|-----|
| **Web Portal** | Azure Static Web Apps with a Copilot-style chat panel | Azure OpenAI (hosted) |
| **IDE (MCP)** | MCP server for VS Code and Claude Code | User's own LLM |

Both surfaces use `@kickstart/harness` — the pack registry, Runner, SSE adapter, and session management.

## Quick Start

### Option 1: Dev Container (recommended)

The easiest way to get started. Open the repo in a GitHub Codespace or VS Code with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers):

1. **GitHub Codespace:** Click **Code → Codespaces → New codespace** on the repo page
2. **VS Code:** Open the repo folder, then **Ctrl+Shift+P → Dev Containers: Reopen in Container**

The container auto-installs dependencies, builds all packages, and starts the dev server. Open [http://localhost:4280](http://localhost:4280) when ready.

### Option 2: Local setup

**Prerequisites:** Node.js 22+, npm 10+

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Start the dev server (Vite + SWA CLI)
npm run dev
```

- **http://localhost:4280** — Full app (SWA CLI: frontend + API)
- **http://localhost:5173** — Vite dev server (HMR, frontend only)

> **Note:** The API requires Azure OpenAI credentials. See [DEVELOPMENT.md](./DEVELOPMENT.md) for configuration details. Without credentials, the app runs in **demo mode** automatically.
> **Default model:** Chat-tier harness agents default to `gpt-5.4` when `KICKSTART_CHAT_MODEL` is unset. Set `KICKSTART_CHAT_MODEL` to point at a different Azure OpenAI deployment.

### Run MCP server (IDE)

```bash
npm run build
node packages/mcp-server/dist/index.js
```

Then configure your MCP client (VS Code or Claude Code) to connect to the server.

## Playground

Open the A2UI playground at [**/?playground**](https://kickstart.aks.azure.sabbour.me/?playground) to build and preview A2UI components with AI. The playground provides an interactive sandbox for exploring the component catalog, testing scenarios, and previewing JSON-driven surfaces in real time — no backend required.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shared core | TypeScript, npm workspaces |
| Web frontend | React 19, Vite 6, A2UI v0.9 |
| Web API | Azure Functions (Node.js) |
| IDE integration | MCP SDK (`@modelcontextprotocol/sdk`) |
| AI | Azure OpenAI |
| Infrastructure | Bicep, Azure Static Web Apps |
| CI/CD | GitHub Actions |
| Testing | Vitest (unit), Playwright (e2e) |

## Project Structure

```
packages/
  core/           Conversation engine, prompts, generators
  web/            React frontend + Azure Functions API
    src/           React app (components, hooks, services, A2UI catalog)
    api/           Azure Functions API
    css/           Stylesheets (Fluent 2 theme, A2UI overrides)
    public/        Static assets (icons, favicon)
  mcp-server/     MCP server for IDE integration
infra/            Bicep templates
docs-site/        Docusaurus documentation site
```

## Documentation

📖 **Full docs:** [sabbour.github.io/kickstart](https://sabbour.github.io/kickstart/)

> **Single source of truth:** `docs-site/docs/` is the canonical documentation. All doc updates go there. The `docs/` directory contains redirect stubs only.

- **[Architecture](https://sabbour.github.io/kickstart/docs/architecture/overview)** — System design, A2UI integration, JSON envelope format
- **[Getting Started](https://sabbour.github.io/kickstart/docs/getting-started/local-setup)** — Local setup, project structure
- **[Deployment Guide](https://sabbour.github.io/kickstart/docs/getting-started/deployment)** — Azure resources, CI/CD, environment variables
- **[Custom Components](https://sabbour.github.io/kickstart/docs/components/custom-catalog)** — Kickstart A2UI catalog
- **[Contributing](./CONTRIBUTING.md)** — Dev setup, code style

## Extending Kickstart

Want to build on the platform? The [Extension Guide](https://sabbour.github.io/kickstart/docs/extending/overview) covers five extension points:

- **[Conversation Phases](https://sabbour.github.io/kickstart/docs/extending/conversation-phases)** — Add new phases to the guided flow (e.g., Monitor, Test)
- **[LLM Tools](https://sabbour.github.io/kickstart/docs/extending/llm-tools)** — Expose new functions to the LLM via OpenAI function calling
- **[Integration Kits](https://sabbour.github.io/kickstart/docs/extending/integration-kits)** — Bundle tools, connectors, prompts, and auth into a composable unit
- **[API Endpoints](https://sabbour.github.io/kickstart/docs/extending/api-endpoints)** — Add Azure Functions endpoints with SSE streaming
- **[MCP Tools](https://sabbour.github.io/kickstart/docs/extending/mcp-tools)** — Extend the IDE integration for VS Code Copilot and Claude Code

## License

This project is licensed under the [MIT License](./LICENSE).
