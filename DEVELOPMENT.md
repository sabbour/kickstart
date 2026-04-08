# Development Guide

Local development setup for the Kickstart monorepo.

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

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build all packages
npm run build

# 3. Configure API credentials (see below)

# 4. Start full-stack dev server
npm run dev
```

This opens the app at **http://localhost:4280** with the static frontend and Azure Functions API running together.

## Configure Azure OpenAI Credentials

The API needs Azure OpenAI credentials to power the conversation engine. Edit `packages/web/api/local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "",
    "AZURE_OPENAI_ENDPOINT": "https://<your-resource>.openai.azure.com",
    "AZURE_OPENAI_API_KEY": "<your-api-key>",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-4o",
    "AZURE_CLIENT_ID": "e71a23c6-aeb4-459a-88fc-07ff96fc9b92",
    "AZURE_CLIENT_SECRET": "<your-client-secret>"
  }
}
```

> **Note:** `local.settings.json` is gitignored — it will never be committed. Each developer needs their own copy.

## Running Just the Frontend

If you're working on HTML/CSS/JS only and don't need the API:

```bash
npm run dev:web
```

This serves the static files at **http://localhost:4280** using `serve`. The app will detect the API is unavailable and fall back to demo mode automatically (yellow "Demo" badge in the chat header).

## Running Full Stack (Frontend + API)

```bash
npm run dev
```

This:
1. Builds `@kickstart/core` (the API depends on it)
2. Starts the SWA CLI, which serves:
   - Static files from `packages/web/` at http://localhost:4280
   - Azure Functions API from `packages/web/api/` at http://localhost:4280/api/*

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
├── web/            # Static HTML/CSS/JS frontend
│   ├── api/        # Azure Functions API (TypeScript)
│   ├── css/        # Stylesheets
│   ├── js/         # Client-side modules
│   └── index.html  # Entry point
└── mcp-server/     # MCP server for IDE integration
```

## npm Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Full-stack dev server (SWA CLI: frontend + API) |
| `npm run dev:web` | Frontend only (static file server, demo mode) |
| `npm run build` | Build all packages |
| `npm run api:build` | Build core + API only |
| `npm test` | Unit/integration tests (vitest) |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run test:e2e:ui` | Playwright E2E tests with UI |
| `npm run lint` | ESLint across all TypeScript packages |
