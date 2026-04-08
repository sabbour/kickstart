# Kickstart

**AI-guided onboarding for deploying apps to AKS Automatic.**

Kickstart helps developers go from "I have an app" to "it's running on Azure" through a guided conversation. It frames AKS Automatic as a scalable app platform — no Kubernetes knowledge required.

## Two Surfaces, One Engine

| Surface | How it works | LLM |
|---------|-------------|-----|
| **Web Portal** | Azure Static Web Apps with a Copilot-style chat panel | Azure OpenAI (hosted) |
| **IDE (MCP)** | MCP server for VS Code and Claude Code | User's own LLM |

Both surfaces share `@kickstart/core` — the conversation engine, A2UI component catalog, prompt system, and code generators.

## Quick Start

### Prerequisites

- Node.js 20+ (22 recommended)
- npm 10+

### Run locally

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Start the web frontend
npx serve packages/web -l 4280
```

Open [http://localhost:4280](http://localhost:4280) to view the app.

### Run MCP server (IDE)

```bash
# Build
npm run build

# Start MCP server
node packages/mcp-server/dist/index.js
```

Then configure your MCP client (VS Code or Claude Code) to connect to the server.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shared core | TypeScript, npm workspaces |
| Web frontend | Vanilla JS, HTML/CSS (Portal Prototyper) |
| Web API | Azure Functions (Node.js) |
| IDE integration | MCP SDK (`@modelcontextprotocol/sdk`) |
| AI | Azure OpenAI |
| Infrastructure | Bicep, Azure Static Web Apps |
| CI/CD | GitHub Actions |
| Testing | Vitest (unit), Playwright (e2e) |

## Project Structure

```
packages/
  core/           Conversation engine, A2UI catalog, prompts, generators
  web/            Portal-style frontend + Azure Functions API
  mcp-server/     MCP server for IDE integration
infra/            Bicep templates, setup scripts
docs/             Architecture and documentation
```

## Documentation

See [`docs/`](./docs/) for detailed documentation:

- **[Architecture](./docs/architecture.md)** — System diagrams (Mermaid), data flows, prompt layers, deployment
- **[Contributing](./CONTRIBUTING.md)** — Dev setup, project structure, code style
- **[Infrastructure](./infra/README.md)** — Azure deployment details

## License

Internal project — Microsoft.
