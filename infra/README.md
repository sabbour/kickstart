# Kickstart — Infrastructure

Infrastructure-as-code for the AKS Kickstart platform.

## Contents

| File | Purpose |
|------|---------|
| `main.bicep` | Azure Static Web App resource (Standard tier), Entra app settings, custom domain |
| `parameters.dev.json` | Dev environment parameters (includes Entra client ID and custom domain) |
| `setup-entra.sh` | Entra ID app registration script |

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
- `https://kickstart.prototypes.aks.azure.sabbour.me`
- `https://kickstart.aks.azure.com`

**API Permissions (delegated):**
- Microsoft Graph `User.Read`
- Azure Service Management `user_impersonation`

### SWA App Settings

The SWA auth config in `staticwebapp.config.json` references these app settings by name:

| Setting Name | How to Set |
|-------------|------------|
| `AZURE_CLIENT_ID` | Set automatically via Bicep (`entraClientId` parameter) |
| `AZURE_CLIENT_SECRET` | Set manually — never commit the secret value |

To set the client secret manually:

```bash
az staticwebapp appsettings set \
  --name kickstart-web-dev \
  --resource-group rg-kickstart-dev \
  --setting-names AZURE_CLIENT_SECRET=<your-secret-value>
```

Or set it via the Azure Portal under Static Web App > Settings > Application settings.

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
| Temp | `kickstart.prototypes.aks.azure.sabbour.me` |
| Future | `kickstart.aks.azure.com` |

Custom domains are configured via Bicep (`customDomainHostname` parameter). Requires a CNAME record pointing to the SWA default hostname before deployment.
