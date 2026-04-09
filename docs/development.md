# Development Guide

Local development setup for the Kickstart monorepo.

> **Also see:** [`DEVELOPMENT.md`](../DEVELOPMENT.md) at the repo root for a quick-start reference.

---

## Prerequisites

- **Node.js 20+** — [Download](https://nodejs.org/)
- **Azure Static Web Apps CLI** — install globally:
  ```bash
  npm install -g @azure/static-web-apps-cli
  ```
- **Azure Functions Core Tools v4** — required for the API:
  ```bash
  npm install -g azure-functions-core-tools@4 --unsafe-perm true
  ```

---

## Quick Start

```bash
# 1. Install all workspace dependencies
npm install

# 2. Build all packages (core → web/api + mcp-server)
npm run build

# 3. Configure Azure OpenAI credentials (see below)

# 4. Start full-stack dev server
npm run dev
```

`npm run dev` starts **Vite** (port 5173, hot module replacement) and **SWA CLI** (port 4280) in parallel. Access the app at **http://localhost:4280**.

---

## Configure Credentials

The API needs Azure OpenAI to power the conversation engine. Create `packages/web/api/local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "",
    "AZURE_OPENAI_ENDPOINT": "https://<your-resource>.openai.azure.com",
    "AZURE_OPENAI_API_KEY": "<your-api-key>",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-4o",
    "AZURE_OPENAI_CODEX_DEPLOYMENT": "gpt-5.3-codex",
    "AZURE_CLIENT_ID": "<your-entra-client-id>",
    "AZURE_CLIENT_SECRET": "<your-client-secret>"
  }
}
```

> **Note:** `local.settings.json` is gitignored — it will never be committed.

---

## Dev Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Full-stack dev server (Vite + SWA CLI in parallel, port 4280) |
| `npm run dev:vite` | Vite dev server only (HMR, port 5173, no API) |
| `npm run build` | Build all packages (`core` → `web` + `mcp-server`) |
| `npm run api:build` | Build `@kickstart/core` + API only |
| `npm test` | Unit/integration tests (vitest, all workspaces) |
| `npm run test:e2e` | Playwright E2E tests (headless) |
| `npm run test:e2e:ui` | Playwright E2E tests with interactive UI |
| `npm run lint` | ESLint across all TypeScript packages |

---

## Running Tests

### Unit and integration tests (vitest)

```bash
# All workspaces
npm test

# Specific workspace
npm test -w @kickstart/core
npm test -w @kickstart/mcp-server
```

Or directly with vitest for more control:

```bash
npx vitest run                  # run once
npx vitest watch                # watch mode
npx vitest run --coverage       # with coverage
```

The root `vitest.config.ts` collects tests from all `packages/*/src/**/__tests__/*.test.ts` files and excludes Playwright specs.

### End-to-end tests (Playwright)

```bash
# Headless
npm run test:e2e
# or
npx playwright test

# With Playwright UI (trace viewer, time-travel debugging)
npm run test:e2e:ui
# or
npx playwright test --ui
```

E2E tests use their own dev server on port 4281 — they don't conflict with the SWA CLI dev server on port 4280.

---

## Build Commands

```bash
# Build everything (recommended)
npm run build

# Build individual packages
npm run build -w @kickstart/core
npm run build -w @kickstart/web
npm run build -w @kickstart/mcp-server
npm run api:build   # core + API (for deployment)
```

Build order matters: `@kickstart/core` must be built before the web API and MCP server because they reference it via TypeScript project references.

---

## Frontend-Only Development

When working on React components and not needing the API:

```bash
npm run dev:vite
```

The app opens at **http://localhost:5173** with hot module replacement. It detects the API is unavailable and falls back to **demo mode** automatically (yellow "Demo" badge in the chat header).

---

## MCP Server Development

```bash
npm run build -w @kickstart/core
npm run build -w @kickstart/mcp-server

# Run via stdio (for testing with an MCP client)
node packages/mcp-server/dist/index.js
```

See [MCP Server docs](./mcp-server.md) for connecting to VS Code Copilot or Claude Code.

---

## Dev Container

The repo ships a `.devcontainer` configuration. Open in a GitHub Codespace or VS Code Dev Container for a pre-configured environment:

1. **Codespace:** Click **Code → Codespaces → New codespace**
2. **VS Code:** Open the repo, then **Ctrl+Shift+P → Dev Containers: Reopen in Container**

The container installs all dependencies, builds packages, and starts `npm run dev` automatically. Ports forwarded: **4280** (SWA CLI) and **5173** (Vite).

---

## Infrastructure (Bicep)

```bash
# Validate
az bicep build --file infra/main.bicep

# Dry run
az deployment group what-if \
  --resource-group rg-kickstart-dev \
  --template-file infra/main.bicep \
  --parameters @infra/parameters.dev.json

# Deploy
az deployment group create \
  --resource-group rg-kickstart-dev \
  --template-file infra/main.bicep \
  --parameters @infra/parameters.dev.json
```

See [Deployment Guide](./deployment.md) for the full infrastructure setup.
