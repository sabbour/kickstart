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
git clone https://github.com/sabbour/kickstart.git
cd kickstart
npm install
```

The root `npm install` installs dependencies for all workspace packages (`packages/core` and `packages/web`).

### 2. Configure environment variables

Create `packages/web/api/local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "",
    "AZURE_OPENAI_ENDPOINT": "https://your-resource.openai.azure.com/",
    "AZURE_OPENAI_API_KEY": "your-api-key",
    "AZURE_OPENAI_CHAT_DEPLOYMENT": "gpt-5.4-mini",
    "AZURE_OPENAI_CODEX_DEPLOYMENT": "gpt-5.4"
  }
}
```

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

## Common Issues

### Functions not starting

Make sure Azure Functions Core Tools v4 is installed:

```bash
func --version
# Should output 4.x.x
```

### OpenAI errors

Verify your local settings file is present and both deployment names match real Azure OpenAI deployments in your resource.
