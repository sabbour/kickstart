# Deployment & Infrastructure Guide

This guide covers how to deploy the Kickstart platform — from Azure resources to CI/CD workflows.

> **Related docs:** [API Reference](./api-reference.md) for environment variables · [MCP Server](./mcp-server.md) for the MCP server setup

---

## Azure Resources

Kickstart requires the following Azure resources:

| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure Static Web App | Hosts the web frontend + API Functions | Standard |
| Azure OpenAI | LLM backend for conversation | — |
| Entra App Registration | Authentication (SPA Auth Code + PKCE) | — |

### Resource Group

All resources are deployed to a single resource group. The default dev environment uses:

- **Subscription:** `4498459e-01d5-4a3f-b07e-8f1f36598c16`
- **Resource Group:** `rg-kickstart-dev`
- **Region:** `centralus`

---

## Bicep Template

**Source:** [`infra/main.bicep`](../infra/main.bicep)

The Bicep template deploys an Azure Static Web App resource:

```bicep
targetScope = 'resourceGroup'

@description('Name of the Static Web App resource')
param swaName string = 'kickstart-web'

@description('Azure region for the Static Web App')
param location string = 'centralus'

@description('SKU for the Static Web App')
@allowed(['Free', 'Standard'])
param skuName string = 'Standard'

@description('Repository URL for the Static Web App (for GitHub integration)')
param repositoryUrl string = ''

@description('Branch to deploy from')
param branch string = 'main'
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `swaName` | `kickstart-web` | Static Web App resource name |
| `location` | `centralus` | Azure region |
| `skuName` | `Standard` | SWA SKU tier (`Free` or `Standard`) |
| `repositoryUrl` | `''` | GitHub repo URL for SWA integration |
| `branch` | `main` | Git branch for deployment |

### Dev Parameters

**Source:** [`infra/parameters.dev.json`](../infra/parameters.dev.json)

```json
{
  "parameters": {
    "swaName": { "value": "kickstart-web-dev" },
    "location": { "value": "centralus" },
    "skuName": { "value": "Standard" },
    "repositoryUrl": { "value": "https://github.com/sabbour/kickstart" },
    "branch": { "value": "main" }
  }
}
```

### Outputs

| Output | Description |
|--------|-------------|
| `defaultHostname` | Default hostname of the Static Web App |
| `resourceId` | Azure resource ID |
| `swaName` | Resource name |

### Build Properties

The Bicep template configures SWA build settings:

```bicep
buildProperties: {
  appLocation: 'packages/web'
  skipGithubActionWorkflowGeneration: true  // We manage our own workflow
}
```

---

## GitHub Actions Workflows

### `deploy-swa.yml` — Static Web App Deployment

**Source:** [`.github/workflows/deploy-swa.yml`](../.github/workflows/deploy-swa.yml)

Deploys the web frontend and API to Azure Static Web Apps on every push to `main` and on PRs.

**Trigger:**
- Push to `main` → production deployment
- PR opened/synced → staging environment (auto-destroyed on PR close)

**Jobs:**

#### `deploy`

```yaml
steps:
  - Checkout code
  - Setup Node.js 20 (with npm cache)
  - npm ci && build core + API
  - Deploy via Azure/static-web-apps-deploy@v1
```

Key configuration:

```yaml
app_location: "packages/web"         # Static frontend
api_location: "packages/web/api"     # Azure Functions API
skip_app_build: true                 # No build step for static HTML
skip_api_build: false                # API needs TypeScript compilation
api_build_command: "npm run build"
```

**Build order is critical:** The API depends on `@kickstart/core`, so both must be built before the SWA action:

```bash
npm ci
npm run build -w @kickstart/core    # Build core first
npm run build -w @kickstart/api     # Then API (depends on core)
```

#### `close_staging`

Runs when a PR is closed — tears down the staging environment:

```yaml
- uses: Azure/static-web-apps-deploy@v1
  with:
    action: "close"
```

**Required secrets:**

| Secret | Description |
|--------|-------------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | SWA deployment token (from Azure Portal) |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions |

---

### `deploy-infra.yml` — Infrastructure Deployment

**Source:** [`.github/workflows/deploy-infra.yml`](../.github/workflows/deploy-infra.yml)

Deploys Azure infrastructure via Bicep on changes to the `infra/` directory.

**Trigger:**
- Push to `main` with changes in `infra/**`
- Manual dispatch (`workflow_dispatch`)

**Authentication:** OIDC (OpenID Connect) — no stored credentials:

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: azure/login@v2
    with:
      client-id: ${{ secrets.AZURE_CLIENT_ID }}
      tenant-id: ${{ secrets.AZURE_TENANT_ID }}
      subscription-id: ${{ env.AZURE_SUBSCRIPTION_ID }}
```

**Steps:**

1. **Checkout code**
2. **Azure Login** via OIDC federation
3. **Create resource group** (idempotent `az group create`)
4. **Deploy Bicep template** with dev parameters
5. **Store deployment outputs** in GitHub step summary

```bash
az deployment group create \
  --resource-group rg-kickstart-dev \
  --template-file infra/main.bicep \
  --parameters @infra/parameters.dev.json
```

**Required secrets:**

| Secret | Description |
|--------|-------------|
| `AZURE_CLIENT_ID` | Entra app registration client ID (for OIDC) |
| `AZURE_TENANT_ID` | Entra tenant ID |

**Environment variables (hardcoded in workflow):**

| Variable | Value | Description |
|----------|-------|-------------|
| `AZURE_SUBSCRIPTION_ID` | `4498459e-...` | Target subscription |
| `AZURE_RESOURCE_GROUP` | `rg-kickstart-dev` | Resource group name |
| `AZURE_LOCATION` | `centralus` | Azure region |

---

## Environment Variables & Secrets

### SWA API (Runtime)

Set these in the Azure Static Web App **Application Settings** (Azure Portal → SWA → Configuration):

| Variable | Description |
|----------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint (e.g., `https://my-openai.openai.azure.com`) |
| `AZURE_OPENAI_DEPLOYMENT` | Model deployment name (e.g., `gpt-4o`) |
| `AZURE_OPENAI_API_KEY` | API key for the Azure OpenAI resource |

### GitHub Secrets

| Secret | Used By | Description |
|--------|---------|-------------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | `deploy-swa.yml` | SWA deployment token |
| `AZURE_CLIENT_ID` | `deploy-infra.yml` | Entra app client ID for OIDC login |
| `AZURE_TENANT_ID` | `deploy-infra.yml` | Entra tenant ID for OIDC login |

---

## Entra App Registration

Kickstart uses an Entra ID (Azure AD) app registration for authentication via SPA Auth Code Flow with PKCE (no client secret for the SPA itself).

**Source:** [`infra/setup-entra.sh`](../infra/setup-entra.sh)

### Running the Setup Script

```bash
# Login to the correct tenant
az login --tenant caglobaldemos2605.onmicrosoft.com

# Run the setup script
chmod +x infra/setup-entra.sh
./infra/setup-entra.sh
```

### What the Script Creates

1. **App Registration** named "Kickstart - AKS Onboarding" with single-tenant sign-in
2. **SPA Redirect URIs:**
   - `http://localhost:8080` (local dev)
   - `http://localhost:4280` (SWA CLI)
   - `https://kickstart.prototypes.aks.azure.sabbour.me` (staging)
   - `https://kickstart.aks.azure.com` (production)
3. **API Permissions (delegated):**
   - Microsoft Graph: `User.Read`
   - Azure Service Management: `user_impersonation`
4. **Client Secret** (for server-side use; SPA uses PKCE)

### Script Output

The script outputs the Client ID, Object ID, Tenant ID, and client secret. Store the secret in GitHub Secrets:

```
AZURE_CLIENT_SECRET=<the-generated-secret>
```

---

## Custom Domain Configuration

After initial deployment, configure custom domains via the Azure Portal:

1. Navigate to the Static Web App resource
2. Go to **Custom domains**
3. Add your domain and follow the DNS validation steps

**Current domains:**
- **Staging:** `kickstart.prototypes.aks.azure.sabbour.me`
- **Production:** `kickstart.aks.azure.com` (future)

SWA automatically provisions and manages TLS certificates for custom domains.

---

## Local Development

### Full Stack (Frontend + API)

```bash
# Install dependencies
npm ci

# Build core and API
npm run build -w @kickstart/core
npm run build -w @kickstart/api

# Create local settings for API
cat > packages/web/api/local.settings.json << 'EOF'
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "",
    "AZURE_OPENAI_ENDPOINT": "https://your-resource.openai.azure.com",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-4o",
    "AZURE_OPENAI_API_KEY": "your-key-here"
  }
}
EOF

# Start SWA CLI
swa start packages/web --api-location packages/web/api
```

Access at `http://localhost:4280`.

### MCP Server Only

```bash
npm ci
npm run build -w @kickstart/core
npm run build -w @kickstart/mcp-server

# Run directly (stdio transport)
node packages/mcp-server/dist/index.js
```

See [MCP Server — Configuration](./mcp-server.md#configuration) for connecting to AI coding assistants.

### Running Tests

```bash
# Run all tests (vitest)
npm test

# Run tests for a specific workspace
npm test -w @kickstart/core
npm test -w @kickstart/mcp-server
```

The root `vitest.config.ts` excludes Playwright e2e specs — those are run separately via `npx playwright test`.

### Infrastructure (Bicep)

```bash
# Validate the Bicep template
az bicep build --file infra/main.bicep

# What-if deployment (dry run)
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
