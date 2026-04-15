# Kickstart — Infrastructure

Infrastructure-as-code for the AKS Kickstart platform.

## Contents

| File | Purpose |
|------|---------|
| `main.bicep` | Azure Static Web App, Key Vault for secrets, managed identity, RBAC, custom domain |
| `parameters.dev.json` | Dev environment parameters (includes Entra client ID, custom domain, Key Vault name) |
| `setup-entra.sh` | Entra ID app registration script |

## Architecture

```
┌─────────────────────┐       ┌──────────────────────────┐
│  Static Web App     │──MI──▶│  Key Vault               │
│  (system-assigned   │       │  • entra-client-secret    │
│   managed identity) │       │  • openai-api-key         │
└─────────────────────┘       └──────────────────────────┘
        │                              ▲
        │  @Microsoft.KeyVault(...)    │
        └──────────────────────────────┘
```

**Secret flow:** Secrets are stored in Azure Key Vault and referenced by SWA app settings using `@Microsoft.KeyVault(SecretUri=...)`. The SWA's system-assigned managed identity is granted the `Key Vault Secrets User` RBAC role, so no API keys or passwords are stored in SWA configuration or ARM state.

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) v2.60+
- Access to the **CA Global Demos 2605** tenant (`caglobaldemos2605.onmicrosoft.com`)
- Subscription: `4498459e-01d5-4a3f-b07e-8f1f36598c16`

## Entra App Registration

The Kickstart web app uses Entra ID (Azure AD) for authentication via SWA's built-in `azureActiveDirectory` identity provider.

| Property | Value |
|----------|-------|
| App Name | Kickstart - AKS Onboarding |
| Client ID | `e71a23c6-aeb4-459a-88fc-07ff96fc9b92` |
| Object ID | `bf6ab22e-d654-4a27-bb35-6df7631f8023` |
| Tenant ID | `d91aa5af-8c1e-442c-b77c-0b92988b387b` |
| Tenant | `caglobaldemos2605.onmicrosoft.com` |
| OpenID Issuer | `https://login.microsoftonline.com/d91aa5af-8c1e-442c-b77c-0b92988b387b/v2.0` |

**SPA Redirect URIs:**
- `http://localhost:8080`
- `http://localhost:4280`
- `https://kickstart.aks.azure.sabbour.me`
- `https://kickstart.aks.azure.com`

**API Permissions (delegated):**
- Microsoft Graph `User.Read`
- Azure Service Management `user_impersonation`

### SWA App Settings

The SWA auth config in `staticwebapp.config.json` references these app settings by name:

| Setting Name | How It's Set |
|-------------|------------|
| `AZURE_CLIENT_ID` | Bicep parameter (`entraClientId`) — not a secret |
| `AZURE_TENANT_ID` | Derived from `subscription().tenantId` in Bicep — not a secret |
| `AZURE_CLIENT_SECRET` | Key Vault reference (`@Microsoft.KeyVault(SecretUri=...)`) |
| `DEPLOY_RUN_SECRET` | Key Vault reference (`@Microsoft.KeyVault(SecretUri=...)`) |
| `AZURE_OPENAI_API_KEY` | Key Vault reference (`@Microsoft.KeyVault(SecretUri=...)`) |
| `AZURE_OPENAI_ENDPOINT` | Bicep parameter — not a secret |
| `AZURE_OPENAI_*_DEPLOYMENT` | Bicep parameters — not secrets |

### Secret Management

Secrets are stored in Azure Key Vault and referenced by SWA via `@Microsoft.KeyVault(SecretUri=...)`. The SWA's system-assigned managed identity has the `Key Vault Secrets User` RBAC role on the vault.

**To set secrets during deployment**, pass them as `@secure()` Bicep parameters:

```bash
az deployment group create \
  --resource-group rg-kickstart-dev \
  --template-file infra/main.bicep \
  --parameters @infra/parameters.dev.json \
  --parameters \
    openAiApiKey='<your-api-key>' \
    entraClientSecret='<your-secret>' \
    deployRunSecret='<32+ char random secret>'
```

**To rotate a secret**, update it in Key Vault:

```bash
az keyvault secret set \
  --vault-name kv-kickstart-dev \
  --name openai-api-key \
  --value '<new-key>'
```

The SWA automatically picks up the latest secret version (versionless URI).

**In CI/CD**, secrets are passed from GitHub Actions secrets. See `.github/workflows/deploy-infra.yml`.

### Auth Routes

| Route | Behavior |
|-------|----------|
| `/login` | Redirects to `/.auth/login/aad` |
| `/logout` | Redirects to `/.auth/logout` |
| `/api/*` | Requires `authenticated` role |
| `/*` (static) | Public (no auth required) |

## Deploy Static Web App

### Via GitHub Actions (recommended)

Push to `main` with changes in `infra/**` — the `deploy-infra.yml` workflow handles it.

### Manual deployment

```bash
# Login
az login --tenant caglobaldemos2605.onmicrosoft.com
az account set --subscription 4498459e-01d5-4a3f-b07e-8f1f36598c16

# Create resource group (if needed)
az group create --name rg-kickstart-dev --location centralus

# Deploy
az deployment group create \
  --resource-group rg-kickstart-dev \
  --template-file infra/main.bicep \
  --parameters @infra/parameters.dev.json
```

## Set Up Entra App Registration

```bash
# Login to the correct tenant first
az login --tenant caglobaldemos2605.onmicrosoft.com

# Run the setup script
chmod +x infra/setup-entra.sh
./infra/setup-entra.sh
```

The script will:
1. Create an Entra app registration named "Kickstart - AKS Onboarding"
2. Configure SPA redirect URIs for localhost, staging, and production
3. Add Microsoft Graph `User.Read` and Azure Service Management `user_impersonation` permissions
4. Create a client secret (store it in GitHub Secrets)
5. Output the Client ID and Tenant ID

### Domains

| Environment | Domain |
|-------------|--------|
| Temp | `kickstart.aks.azure.sabbour.me` |
| Future | `kickstart.aks.azure.com` |

Custom domains are configured via Bicep (`customDomainHostname` parameter). Requires a CNAME record pointing to the SWA default hostname before deployment.
