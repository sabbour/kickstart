# Kickstart — Infrastructure

Infrastructure-as-code for the AKS Kickstart platform.

## Contents

| File | Purpose |
|------|---------|
| `main.bicep` | Azure Static Web App resource (Standard tier) |
| `parameters.dev.json` | Dev environment parameters |
| `setup-entra.sh` | Entra ID app registration script |

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) v2.60+
- Access to the **CA Global Demos 2605** tenant (`caglobaldemos2605.onmicrosoft.com`)
- Subscription: `4498459e-01d5-4a3f-b07e-8f1f36598c16`

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

Custom domains are configured via Azure Portal after initial deployment.
