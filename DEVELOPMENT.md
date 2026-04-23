# Development Guide

Local development setup for the Kickstart monorepo.

## Prerequisites

- **Node.js 22+** — [Download](https://nodejs.org/)
- **Azure Static Web Apps CLI** — install globally:
  ```bash
  npm install -g @azure/static-web-apps-cli
  ```
- **Azure Functions Core Tools v4** — required for the API:
  ```bash
  npm install -g azure-functions-core-tools@4 --unsafe-perm true
  ```

## Quick Start

### Dev Container (easiest)

Open the repo in a **GitHub Codespace** or **VS Code Dev Container**:

1. **Codespace:** Click **Code → Codespaces → New codespace** on the GitHub repo page
2. **VS Code:** Open the repo folder, then **Ctrl+Shift+P → Dev Containers: Reopen in Container**

The container installs dependencies, builds packages, and starts the dev server automatically. The app opens at **http://localhost:4280**.

Ports forwarded:
- **4280** — SWA CLI (full app: frontend + API)
- **5173** — Vite dev server (HMR, frontend only)

### Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Build all packages
npm run build

# 3. Configure API credentials (see below)

# 4. Start full-stack dev server
npm run dev
```

This starts **Vite** (port 5173) and **SWA CLI** (port 4280) in parallel using `concurrently`. The SWA CLI proxies to Vite for the frontend and serves Azure Functions for the API.

## Configure Environment Variables

The API needs Azure OpenAI credentials and optional authentication configuration. See [Environment Variables](docs-site/docs/getting-started/environment-variables.md) for a complete reference.

Create `packages/web/api/local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "",
    "AZURE_OPENAI_ENDPOINT": "https://<your-resource>.openai.azure.com",
    "AZURE_OPENAI_API_KEY": "<your-api-key>",
    "KICKSTART_CHAT_MODEL": "gpt-5.4-mini",
    "KICKSTART_CODEX_MODEL": "gpt-5.4",
    "AZURE_CLIENT_ID": "your-app-id",
    "AZURE_TENANT_ID": "your-tenant-id",
    "AZURE_CLIENT_SECRET": "<your-client-secret>"
  }
}
```

> **Note:** `local.settings.json` is gitignored — it will never be committed. Each developer needs their own copy.

For a complete list of all environment variables, defaults, and fallback chains, see [Getting Started → Environment Variables](docs-site/docs/getting-started/environment-variables.md).

### Stepwise Generation Feature Flag

The `STEPWISE_GENERATION_V1` environment variable enables **codex-backed stepwise setup generation** — a feature that streams multi-step file generation during the Generate phase using Azure OpenAI's Responses API.

**Default behavior:**
- **Production (SWA):** `true` (enabled by default via Bicep parameter `enableStepwiseGeneration`)
- **Local dev:** Set to `"true"` in `local.settings.json` to enable
- **Feature activation:** Only activates on the Generate phase when:
  - Session is server-owned (`routingPhaseTrusted = true`), OR
  - Client-supplied setup-generation snapshot is validated (`setupGenerationTrusted = true`)

**When enabled:**
- `/api/converse` detects the Generate phase and activates stepwise SSE streaming
- Generated files are streamed in real-time, workspace snapshots are created per turn
- Users see progress as files are generated, not just the final result

**To disable locally:** Set `"STEPWISE_GENERATION_V1": "false"` in `local.settings.json` to fall back to standard chat completions.

## Running Just the Frontend

If you're working on React components and don't need the API:

```bash
npm run dev:vite
```

This starts the Vite dev server at **http://localhost:5173** with hot module replacement (HMR). The app will detect the API is unavailable and fall back to demo mode automatically (yellow "Demo" badge in the chat header).

## Running Full Stack (Frontend + API)

```bash
npm run dev
```

This runs both services in parallel:
1. **Vite** dev server on port 5173 (React app with HMR)
2. **SWA CLI** on port 4280 (proxies to Vite, serves Azure Functions API)

The SWA CLI proxies `/api/*` requests to the Azure Functions host, just like the production Azure Static Web Apps environment.

## Running Tests

### Unit / integration tests (vitest)

```bash
npm test
```

### End-to-end tests (Playwright)

```bash
# Run headless
npm run test:e2e

# Run with UI
npm run test:e2e:ui
```

E2E tests use their own dev server on port 4281 — they don't conflict with the SWA CLI dev server on port 4280.

## Project Structure

```
packages/
├── core/           # TypeScript conversation engine
├── web/            # React 19 + Vite 6 frontend
│   ├── api/        # Azure Functions API (TypeScript)
│   ├── src/        # React app
│   │   ├── components/   # Chat, FileEditor, Landing
│   │   ├── hooks/        # useA2UI, useChat
│   │   ├── services/     # API client, demo scenarios, virtual-fs
│   │   ├── catalog/      # Custom A2UI components
│   │   └── vendor/       # Vendored A2UI v0.9
│   ├── css/        # Stylesheets (Fluent 2, A2UI overrides)
│   └── public/     # Static assets (copied to dist/)
└── mcp-server/     # MCP server for IDE integration
```

## npm Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Full-stack dev server (Vite + SWA CLI in parallel) |
| `npm run dev:vite` | Vite dev server only (HMR, port 5173) |
| `npm run build` | Build all packages |
| `npm run api:build` | Build core + API only |
| `npm test` | Unit/integration tests (vitest) |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run test:e2e:ui` | Playwright E2E tests with UI |
| `npm run lint` | ESLint across all TypeScript packages |
