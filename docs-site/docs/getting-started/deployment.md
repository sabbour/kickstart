---
sidebar_position: 3
---

# Deployment & Infrastructure Guide

How to deploy the Kickstart platform — from Azure resources to CI/CD workflows.

## Azure Resources

| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure Static Web App | Hosts the web frontend + API Functions | Standard |
| Azure OpenAI | LLM backend for conversation | — |
| Entra App Registration | Authentication (SPA Auth Code + PKCE) | — |

All resources are deployed to a single resource group.

:::info Replace with your environment values
The commands and examples throughout this guide use placeholder values. Replace them with your actual Azure environment details before running any commands:

| Placeholder | Replace with |
|-------------|-------------|
| `<subscription-id>` | Your Azure subscription ID |
| `<resource-group>` | Your resource group name (e.g. `rg-kickstart-dev`) |
| `<your-tenant-id-or-domain>` | Your Entra tenant ID (GUID) or domain (e.g. `contoso.onmicrosoft.com`) |
:::

Example configuration:

- **Subscription:** `<subscription-id>`
- **Resource Group:** `<resource-group>`
- **Region:** `centralus`

## Bicep Template

**Source:** `infra/main.bicep`

The Bicep template deploys an Azure Static Web App resource.

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `swaName` | `kickstart-web` | Static Web App resource name |
| `location` | `centralus` | Azure region |
| `skuName` | `Standard` | SWA SKU tier (`Free` or `Standard`) |
| `repositoryUrl` | `''` | GitHub repo URL for SWA integration |
| `branch` | `main` | Git branch for deployment |

### Dev Parameters

**Source:** `infra/parameters.dev.json`

```json
{
  "parameters": {
    "swaName": { "value": "kickstart-web-dev" },
    "location": { "value": "centralus" },
    "skuName": { "value": "Standard" },
    "repositoryUrl": { "value": "https://github.com/azure-management-and-platforms/kickstart" },
    "branch": { "value": "main" }
  }
}
```

### Build Properties

The Bicep template configures SWA build settings:

```bicep
buildProperties: {
  appLocation: 'packages/web'
  skipGithubActionWorkflowGeneration: true  // We manage our own workflow
}
```

## GitHub Actions Workflows

### `deploy-swa.yml` — Static Web App Deployment

Deploys the web frontend and API to Azure Static Web Apps on every push to `main` and on PRs.

After upload, the workflow retries `GET /api/health` against the production custom domain and fails if the live API never returns `200 {"status":"ok"}`. This catches managed Functions startup regressions that can slip past a successful deploy job.

**Triggers:**
- Push to `main` → production deployment
- PR opened/synced → staging environment (auto-destroyed on PR close)

**Build order is critical:** The API depends on `@aks-kickstart/harness`, so both must be built before the SWA action:

```bash
npm ci
npm run build -w @aks-kickstart/harness    # Build core first
npm run build -w @kickstart/api     # Then API (depends on core)
```

**Key SWA action configuration:**

```yaml
app_location: "packages/web"         # Static frontend
api_location: "packages/web/api"     # Azure Functions API
skip_app_build: true                 # No build step for static HTML
skip_api_build: false                # API needs TypeScript compilation
api_build_command: "npm run build"
```

**Required secrets:**

| Secret | Description |
|--------|-------------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | SWA deployment token (from Azure Portal) |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions |

### `deploy-infra.yml` — Infrastructure Deployment

Deploys Azure infrastructure via Bicep on changes to the `infra/` directory.

**Triggers:**
- Push to `main` with changes in `infra/**`
- Manual dispatch (`workflow_dispatch`)

**Authentication:** OIDC (OpenID Connect) — no stored credentials:

```yaml
permissions:
  id-token: write
  contents: read
```

**Steps:**
1. Checkout code
2. Azure Login via OIDC federation
3. Create resource group (idempotent `az group create`)
4. Deploy Bicep template with dev parameters
5. Store deployment outputs in GitHub step summary

**Required secrets:**

| Secret | Description |
|--------|-------------|
| `AZURE_CLIENT_ID` | Entra app registration client ID (for OIDC) |
| `AZURE_TENANT_ID` | Entra tenant ID |

## Environment Variables & Secrets

### SWA API (Runtime)

Set these in the Azure Static Web App **Application Settings** (Azure Portal → SWA → Configuration):

| Variable | Description |
|----------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint (e.g., `https://my-openai.openai.azure.com`) |
| `AZURE_OPENAI_CHAT_DEPLOYMENT` | Chat deployment for discover/design/review/handoff/deploy turns |
| `AZURE_OPENAI_CODEX_DEPLOYMENT` | Generate deployment for trusted `generate` turns |
| `AZURE_OPENAI_DEPLOYMENT` | Optional legacy fallback when explicit chat/coding deployments are not set |
| `AZURE_OPENAI_API_KEY` | API key for the Azure OpenAI resource |

### GitHub Secrets

| Secret | Used By | Description |
|--------|---------|-------------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | `deploy-swa.yml` | SWA deployment token |
| `AZURE_CLIENT_ID` | `deploy-infra.yml` | Entra app client ID for OIDC login |
| `AZURE_TENANT_ID` | `deploy-infra.yml` | Entra tenant ID for OIDC login |

## Entra App Registration

Kickstart uses an Entra ID (Azure AD) app registration for authentication via SPA Auth Code Flow with PKCE (no client secret for the SPA itself).

**Source:** `infra/setup-entra.sh`

### Running the Setup Script

```bash
# Login to the correct tenant
az login --tenant <your-tenant-id-or-domain>

# Run the setup script
chmod +x infra/setup-entra.sh
./infra/setup-entra.sh
```

### What the Script Creates

1. **App Registration** named "Kickstart - AKS Onboarding" with single-tenant sign-in
2. **SPA Redirect URIs:**
   - `http://localhost:8080` (local dev)
   - `http://localhost:4280` (SWA CLI)
   - `https://kickstart.aks.azure.sabbour.me` (staging)
   - `https://kickstart.aks.azure.com` (production)
3. **API Permissions (delegated):**
   - Microsoft Graph: `User.Read`
   - Azure Service Management: `user_impersonation`
4. **Client Secret** (for server-side use; SPA uses PKCE)

The script outputs the Client ID, Object ID, Tenant ID, and client secret. Store the secret in GitHub Secrets:

```
AZURE_CLIENT_SECRET=<the-generated-secret>
```

## Custom Domain Configuration

After initial deployment, configure custom domains via the Azure Portal:

1. Navigate to the Static Web App resource
2. Go to **Custom domains**
3. Add your domain and follow the DNS validation steps

**Current domains:**
- **Staging:** `kickstart.aks.azure.sabbour.me`
- **Production:** `kickstart.aks.azure.com` (future)

SWA automatically provisions and manages TLS certificates for custom domains.

## MCP Server — Sticky Routing Requirement

The MCP server (`@kickstart/mcp-server`) stores interrupt state (pending UserActions) in
**process memory**. This has important deployment implications:

### Single-instance deployments

No special configuration required — all requests for a given stdio connection hit the same
process automatically.

### Multi-instance / load-balanced deployments

When running multiple MCP server instances behind a load balancer (e.g., HTTP-SSE transport),
you **must configure sticky sessions** so that all requests from a given MCP connection are
routed to the same process instance. Without sticky routing:

- A resume request may land on a different instance that has no record of the pending interrupt.
- The resume endpoint will return **404** even though the interrupt was issued successfully.

Configure your load balancer (Azure Application Gateway, NGINX, etc.) with cookie-based or
header-based session affinity keyed on the MCP `connectionId` header or session cookie.

### Process restart → 404

In-memory interrupt state does **not** survive a process restart. If the MCP server process
is restarted while a UserAction is pending:

- The interrupt store is cleared.
- Any subsequent `resume` call returns **404**.
- The MCP client must start a new conversation via the `converse` tool.

This is expected and correct behaviour — do not attempt to persist interrupt state across
restarts, as the CAS replay guard relies on the in-memory `consumed` flag.
