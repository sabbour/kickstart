# Deployment Handover Guide

This guide is for the team taking over Kickstart from proof of concept to hardened deployment. It makes the current deployment path explicit: what owns what, which secrets are required, which workflow runs first, and what must be validated after each release.

> Primary sources: [`infra/main.bicep`](../infra/main.bicep), [`.github/workflows/deploy-infra.yml`](../.github/workflows/deploy-infra.yml), [`.github/workflows/deploy-swa.yml`](../.github/workflows/deploy-swa.yml), and the repo [`README`](../README.md).

---

## 1) Ownership assumptions and prerequisites

The receiving team should assume ownership of:

- **Azure subscription + resource group** used for the deployed environment
- **Azure Static Web App** and its managed Functions API
- **Azure Key Vault** used for secret-backed SWA app settings
- **Azure OpenAI resource** and model deployments
- **Entra app registration** used by SWA auth
- **GitHub repository settings and Actions secrets**
- **Application Insights / Log Analytics ownership**, whether reused or provisioned by infra

Minimum access required:

- **GitHub repo admin or maintainer** who can manage Actions secrets and run workflows
- **Azure Contributor** on the target resource group/subscription
- Permission to create **role assignments** (SWA managed identity needs Key Vault access)
- Permission to manage the **Entra app registration** or coordinate with the identity team

Baseline tooling for manual validation:

- `az` CLI with Bicep support
- `gh` CLI or GitHub UI access
- Node.js 20+ / npm

---

## 2) Current deployment model

Kickstart deploys in two separate layers:

1. **Infrastructure layer** — `deploy-infra.yml`
   - Creates or updates Azure resources from `infra/main.bicep`
   - Configures SWA app settings
   - Pushes secrets into Key Vault and references them from SWA
   - Handles the Application Insights connection string path

2. **Application layer** — `deploy-swa.yml`
   - Builds `@kickstart/core`
   - Builds the Azure Functions API in `packages/web/api`
   - Builds the Vite frontend in `packages/web`
   - Uploads the frontend + API bundle to Azure Static Web Apps

**Important:** the app deploy assumes the infra deploy has already created and configured the target SWA and its runtime settings.

---

## 3) Required GitHub secrets and config inputs

### GitHub Actions secrets

These are the inputs another team must set in the repository before relying on CI/CD:

| Secret | Required | Used by | Purpose |
|---|---|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Yes | `deploy-swa.yml` | Upload token for Azure Static Web Apps deployment |
| `AZURE_CLIENT_ID` | Yes | `deploy-infra.yml` | OIDC login client ID for Azure workflow auth |
| `AZURE_TENANT_ID` | Yes | `deploy-infra.yml` | OIDC tenant ID for Azure workflow auth |
| `AZURE_CLIENT_SECRET` | Yes | `deploy-infra.yml` | Stored in Key Vault, referenced by SWA auth config |
| `AZURE_OPENAI_API_KEY` | Yes | `deploy-infra.yml` | Stored in Key Vault, referenced by runtime |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Conditional | `deploy-infra.yml` | Supply only when reusing an existing Application Insights resource; never commit the value |

### Non-secret deployment inputs

These are currently committed in `infra/parameters.dev.json` or hardcoded in workflow env:

| Input | Current source |
|---|---|
| SWA name | `infra/parameters.dev.json` |
| Azure region | `infra/parameters.dev.json` / `deploy-infra.yml` |
| Repo URL | `infra/parameters.dev.json` |
| Deployment branch | `infra/parameters.dev.json` |
| Entra client ID | `infra/parameters.dev.json` |
| Custom domain hostname | `infra/parameters.dev.json` |
| Azure OpenAI endpoint + deployment names | `infra/parameters.dev.json` |
| Key Vault name | `infra/parameters.dev.json` |
| Subscription ID / resource group | `deploy-infra.yml` env |

### Application Insights secret path

The current contract is:

- `deploy-infra.yml` passes `secrets.APPLICATIONINSIGHTS_CONNECTION_STRING` into the secure Bicep parameter `appInsightsConnectionString`
- `infra/main.bicep`:
  - stores that value in Key Vault when provided
  - points SWA runtime setting `APPLICATIONINSIGHTS_CONNECTION_STRING` at the Key Vault secret
  - otherwise provisions a new Application Insights + Log Analytics pair and uses that generated connection string
- the browser reads telemetry config at runtime from `/api/client-config`
- the managed Functions API reads `APPLICATIONINSIGHTS_CONNECTION_STRING` from its SWA environment

**Do not** put the connection string in committed parameter files, docs examples with real values, PR text, or source code.

---

## 4) Deploy order and dependency chain

Use this order every time:

### Step 1 — validate infra inputs

Before deploying, confirm:

- all required GitHub secrets exist
- `infra/parameters.dev.json` matches the intended environment
- the Entra app registration redirect URIs and tenant are correct
- the target resource group/subscription are still the intended ones

### Step 2 — deploy infrastructure first

Run **Deploy Infrastructure** (`.github/workflows/deploy-infra.yml`) first.

This workflow:

1. logs into Azure via OIDC
2. creates/updates the resource group
3. deploys `infra/main.bicep`
4. configures SWA app settings and Key Vault references
5. emits deployment outputs in the GitHub step summary

Infra must succeed before the SWA deploy, because the app depends on:

- existing SWA resource
- Key Vault references resolving
- auth settings being present
- Azure OpenAI settings being available at runtime
- Application Insights wiring being present before browser/API telemetry can light up

### Step 3 — deploy frontend + API

Run **Deploy to Azure Static Web Apps** (`.github/workflows/deploy-swa.yml`) after infra is ready.

This workflow:

1. runs `npm ci`
2. builds `@kickstart/core`
3. builds `@kickstart/api`
4. builds the Vite frontend
5. uploads frontend + API to SWA

### Step 4 — run post-deploy validation

Do not treat workflow success alone as production validation. Run the checks in section 5 after both workflows complete.

---

## 5) Post-deploy validation checklist

After deployment, validate all of the following:

### Infrastructure and config

- `deploy-infra.yml` completed successfully
- step summary shows expected SWA name / hostname
- Application Insights source is what you expected:
  - `secret-supplied` when reusing an existing App Insights instance
  - `provisioned` when letting Bicep create one
- Key Vault exists and SWA managed identity has secret-read access

### Static Web App and API health

- site loads at the expected hostname
- `GET /api/health` returns `200` with `{ "status": "ok" }`
- authenticated routes no longer 404 at the edge
- Azure login flow redirects correctly and returns to the app

### Functional smoke checks

- sign in through SWA auth
- load the main chat surface
- send a conversation request that exercises `/api/converse`
- verify any Azure/OpenAI-backed flow works with real runtime config

### Observability checks

- frontend page view events appear in Application Insights
- frontend dependency/AJAX calls appear
- backend request telemetry appears for Functions routes
- correlation between browser dependency calls and API requests is visible

### Build/runtime sanity

- deployed frontend version matches the expected commit/build
- no startup crash from bundled non-runtime files
- no API cold-start import error from bundled dependencies

---

## 6) Troubleshooting and rollback notes

### If infra succeeds but the app fails

Likely causes:

- stale or missing `AZURE_STATIC_WEB_APPS_API_TOKEN`
- build/runtime break in `packages/web` or `packages/web/api`
- frontend deployed successfully but API startup failed

Check:

- `deploy-swa.yml` logs
- SWA deployment status in Azure Portal
- `/api/health`

### If the site works but API routes 404

Treat this as a managed Functions startup failure until proven otherwise.

Known prior failure mode:

- Azure Functions v4 imports every file matched by the package `main` glob on startup
- bundling test files or incompatible runtime dependencies can crash module import and leave every `/api/*` route effectively unavailable

### If auth is broken

Check:

- SWA app settings for `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`
- Entra redirect URIs
- custom domain alignment with auth expectations

### If telemetry is missing

Check:

- whether infra used `secret-supplied` or `provisioned`
- SWA runtime config contains `APPLICATIONINSIGHTS_CONNECTION_STRING`
- `/api/client-config` returns telemetry config
- CSP still allows Azure Monitor / Application Insights endpoints

### Rollback

There is no separate documented release orchestration yet. Current safe rollback is:

1. redeploy the last known good commit through `deploy-swa.yml`
2. if infra changed incompatibly, revert the infra change and rerun `deploy-infra.yml`
3. re-run post-deploy validation, especially `/api/health`, auth, and telemetry

For production hardening, the receiving team should add a formal rollback playbook and release/version pinning policy.

---

## 7) Proof-of-concept limitations the receiving team should harden

Plan follow-up work in these areas:

- **Environment strategy** — current docs/workflows are dev-environment-centric; introduce explicit dev/stage/prod separation
- **Secret management discipline** — inventory all required secrets and move toward formal ownership/rotation policy
- **Release process** — add clear promotion, rollback, and environment approval gates
- **Monitoring / alerting** — App Insights wiring exists, but operational alerts/dashboards are not documented here
- **Identity ownership** — formalize Entra app registration ownership and redirect URI change process
- **Infrastructure parameterization** — reduce hardcoded subscription/resource-group assumptions in workflows
- **Deployment smoke tests** — automate post-deploy health/auth/telemetry checks
- **Disaster recovery** — document restoration steps for SWA, Key Vault, and App Insights dependencies

---

## 8) Manual commands reference

### Validate Bicep

```bash
az bicep build --file infra/main.bicep
```

### What-if infra deployment

```bash
az deployment group what-if \
  --resource-group rg-kickstart-dev \
  --template-file infra/main.bicep \
  --parameters @infra/parameters.dev.json
```

### Manual infra deployment with existing App Insights

```bash
az deployment group create \
  --resource-group rg-kickstart-dev \
  --template-file infra/main.bicep \
  --parameters @infra/parameters.dev.json \
  --parameters appInsightsConnectionString='<existing-app-insights-connection-string>'
```

### Manual app build path used by SWA deploy

```bash
npm ci
npm run build -w @kickstart/core
npm run build -w @kickstart/api
cd packages/web && npx vite build
```
