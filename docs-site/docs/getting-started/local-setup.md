---
sidebar_position: 1
---

# Local Development Setup

Get Kickstart running locally in a few minutes.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org/) |
| Azure Functions Core Tools | v4 | [Install guide](https://learn.microsoft.com/azure/azure-functions/functions-run-local) |
| Azure OpenAI access | — | [Request access](https://learn.microsoft.com/azure/ai-services/openai/overview) |

## Setup

### 1. Clone and install

```bash
git clone https://github.com/azure-management-and-platforms/kickstart.git
cd kickstart
npm install
```

The root `npm install` installs dependencies for all workspace packages (`packages/harness` and `packages/web`).

### 2. Configure environment variables

Create `packages/web/api/local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "",
    "AZURE_OPENAI_ENDPOINT": "https://your-resource.cognitiveservices.azure.com/",
    "AZURE_OPENAI_API_KEY": "your-api-key",
    "KICKSTART_CHAT_MODEL": "gpt-5.4",
    "KICKSTART_CODEX_MODEL": "gpt-5.4",
    "KICKSTART_INSPIRE_MODEL": "gpt-5.4-nano"
  }
}
```

:::note Endpoint format
For **Azure AI Services** (multi-service) resources, the endpoint uses `.cognitiveservices.azure.com/`. For legacy single-service Azure OpenAI resources, use `.openai.azure.com/`. Check your resource in the Azure Portal under **Keys and Endpoint**.
:::

:::caution
Never commit `local.settings.json` files to source control. The repo already ignores them.
:::

### 3. Start the development server

```bash
npm run dev
```

This starts:
- **Vite dev server** — React frontend with hot module replacement
- **SWA CLI** — local Azure Static Web App emulator with functions

### 4. Open the app

Navigate to [http://localhost:4280](http://localhost:4280) in your browser.

The SWA CLI proxies API requests from the frontend to the local Azure Functions runtime, matching the production Azure Static Web App behavior.

## Dev Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Full-stack dev server (Vite + SWA CLI in parallel, port 4280) |
| `npm run dev:vite` | Vite dev server only (HMR, port 5173, no API) |
| `npm run build` | Build all packages (`core` → `web` + `mcp-server`) |
| `npm run api:build` | Build `@aks-kickstart/harness` + API only |
| `npm test` | Unit/integration tests (vitest, all workspaces) |
| `npm run test:e2e` | Playwright E2E tests (headless) |
| `npm run test:e2e:ui` | Playwright E2E tests with interactive UI |
| `npm run lint` | ESLint across all TypeScript packages |

## Running Tests

### Unit and integration tests (vitest)

```bash
# All workspaces
npm test

# Specific workspace
npm test -w @aks-kickstart/harness
npm test -w @kickstart/mcp-server
```

Or directly with vitest for more control:

```bash
npx vitest run            # run once
npx vitest watch          # watch mode
npx vitest run --coverage # with coverage
```

The root `vitest.config.ts` collects tests from all `packages/*/src/**/__tests__/*.test.ts` files and excludes Playwright specs.

### End-to-end tests (Playwright)

```bash
npm run test:e2e       # headless
npm run test:e2e:ui    # with Playwright UI (trace viewer, time-travel debugging)
```

E2E tests use their own dev server on port 4281 — they don't conflict with the SWA CLI dev server on port 4280.

## Build Commands

```bash
# Build everything (recommended)
npm run build

# Build individual packages
npm run build -w @aks-kickstart/harness
npm run build -w @kickstart/web
npm run build -w @kickstart/mcp-server
npm run api:build   # core + API (for deployment)
```

Build order matters: `@aks-kickstart/harness` must be built before the web API and MCP server because they reference it via TypeScript project references.

## Frontend-Only Development

When working on React components without needing the API:

```bash
npm run dev:vite
```

The app opens at **http://localhost:5173** with HMR. It detects the API is unavailable and falls back to **demo mode** automatically (yellow "Demo" badge in the chat header).

## MCP Server Development

```bash
npm run build -w @aks-kickstart/harness
npm run build -w @kickstart/mcp-server

# Run via stdio (for testing with an MCP client)
node packages/mcp-server/dist/index.js
```

See [MCP Tools](../pack-authoring/mcp-tools.md) for connecting to VS Code Copilot or Claude Code.

## Dev Container

The repo ships a `.devcontainer` configuration. Open in a GitHub Codespace or VS Code Dev Container for a pre-configured environment:

1. **Codespace:** Click **Code → Codespaces → New codespace**
2. **VS Code:** Open the repo, then **Ctrl+Shift+P → Dev Containers: Reopen in Container**

The container installs all dependencies, builds packages, and starts `npm run dev` automatically. Ports forwarded: **4280** (SWA CLI) and **5173** (Vite).

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

See [Deployment Guide](./deployment.md) for the full infrastructure and CI/CD setup.

## Common Issues

### Functions not starting

Make sure Azure Functions Core Tools v4 is installed:

```bash
func --version
# Should output 4.x.x
```

### OpenAI errors

Verify your local settings file is present and both deployment names match real Azure OpenAI deployments in your resource.

## Authentication States

Kickstart shows different UI states depending on whether GitHub OAuth and Azure connectors are configured.

### GitHub Sign In — "not available in this environment"

If `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are not configured, the GitHub Sign In button is **disabled** and shows an info banner:

> _"GitHub Sign In is not available in this environment. The GitHub OAuth app has not been configured."_

This is expected in local dev without OAuth credentials. No 503 errors are thrown — the button is simply inert.

**To enable GitHub login locally:** Create a GitHub OAuth App (Settings → Developer settings → OAuth Apps), add your `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to `local.settings.json`, and set the callback URL to `http://localhost:4280/api/github-auth/callback`.

### Azure Sign In — disabled state vs. Demo Mode

| Situation | UI State |
|-----------|----------|
| Azure connector absent, `KICKSTART_PLAYGROUND=false` | Sign In button disabled with "not available" tooltip |
| Azure connector absent, `KICKSTART_PLAYGROUND=true` | **Demo Mode** — mock user shown with a blue "Demo Mode" badge |
| Azure connector present, authenticated | Green "Connected" dot |

**Demo Mode** is an explicit opt-in via `KICKSTART_PLAYGROUND=true`. It shows a mock authenticated user so you can test UI flows without a real Azure identity. A blue "Demo Mode" badge replaces the green Connected dot to make it clear you are in a simulated state.

> ⚠️ Never deploy with `KICKSTART_PLAYGROUND=true` in production — demo mode bypasses real authentication.

