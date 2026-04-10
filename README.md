# Kickstart

**AI-guided onboarding for deploying apps to AKS Automatic.**

Kickstart helps developers go from "I have an app" to "it's running on Azure" through a guided conversation. It frames AKS Automatic as a scalable app platform — no Kubernetes knowledge required.

🌐 **Live app:** [kickstart.aks.azure.sabbour.me](https://kickstart.aks.azure.sabbour.me)
📖 **Docs:** [sabbour.github.io/kickstart](https://sabbour.github.io/kickstart/)
🎮 **Playground:** [/?playground](https://kickstart.aks.azure.sabbour.me/?playground) — Explore the A2UI component library and demo scenarios

## Features

- **AI-guided landing page** — Track cards, framework pills, and an ✨ inspiration button that generates app ideas via AI
- **A2UI component system** — 16 custom components + Fluent UI 2 styled vendor catalog, rendered from structured JSON returned by the LLM
- **Component playground** — Interactive sidebar-navigated demo surface (https://kickstart.aks.azure.sabbour.me/?playground) for exploring A2UI components, scenarios, and questionnaire flows
- **Fat A2UI components** — Azure and GitHub login cards, resource pickers, and action buttons with real API integration, in-memory token storage, and operation allowlisting
- **LLM function calling** — Tool system enables the LLM to directly query Azure resources, GitHub repos, and web content
- **ServiceConnector & ServicePack patterns** — Declarative auth requirements, kit lifecycle hooks, and dependency validation for seamless Azure/GitHub integration
- **CORS proxy security** — Private IP filtering, redirect validation, and hostname allowlisting for safe cross-origin API calls
- **Action system** — Unified button action pipeline with `/api/action` endpoint for component-driven interactions
- **Azure Functions API** — Streaming conversation proxy, code generation (Codex), CORS proxies for ARM/GitHub/Pricing APIs
- **MCP server** — IDE integration for VS Code Copilot and Claude Code via `@kickstart/mcp-server`
- **Monorepo** — `packages/core` (engine), `packages/web` (React 19 + Vite 6), `packages/mcp-server` (MCP tools)

## Two Surfaces, One Engine

| Surface | How it works | LLM |
|---------|-------------|-----|
| **Web Portal** | Azure Static Web Apps with a Copilot-style chat panel | Azure OpenAI (hosted) |
| **IDE (MCP)** | MCP server for VS Code and Claude Code | User's own LLM |

Both surfaces share `@kickstart/core` — the conversation engine, A2UI component catalog, prompt system, and code generators.

## Quick Start

### Option 1: Dev Container (recommended)

The easiest way to get started. Open the repo in a GitHub Codespace or VS Code with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers):

1. **GitHub Codespace:** Click **Code → Codespaces → New codespace** on the repo page
2. **VS Code:** Open the repo folder, then **Ctrl+Shift+P → Dev Containers: Reopen in Container**

The container auto-installs dependencies, builds all packages, and starts the dev server. Open [http://localhost:4280](http://localhost:4280) when ready.

### Option 2: Local setup

**Prerequisites:** Node.js 20+ (22 recommended), npm 10+

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

- **[Architecture](https://sabbour.github.io/kickstart/docs/architecture/overview)** — System design, A2UI integration, JSON envelope format
- **[Getting Started](https://sabbour.github.io/kickstart/docs/getting-started/local-setup)** — Local setup, project structure
- **[Custom Components](https://sabbour.github.io/kickstart/docs/components/custom-catalog)** — Kickstart A2UI catalog
- **[Contributing](./CONTRIBUTING.md)** — Dev setup, code style
- **[Development Guide](./DEVELOPMENT.md)** — Credentials, scripts, testing

## License

This project is licensed under the [MIT License](./LICENSE).
