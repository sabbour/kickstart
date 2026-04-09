// ──────────────────────────────────────────────────────────────────
// Kickstart — Azure Static Web App infrastructure
// ──────────────────────────────────────────────────────────────────

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

@description('Entra ID (Azure AD) client ID for authentication')
param entraClientId string = ''

@description('Custom domain hostname (e.g., kickstart.aks.azure.sabbour.me). Leave empty to skip.')
param customDomainHostname string = ''

// ── Static Web App ──────────────────────────────────────────────

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: location
  sku: {
    name: skuName
    tier: skuName
  }
  properties: {
    repositoryUrl: repositoryUrl
    branch: branch
    buildProperties: {
      appLocation: 'packages/web/dist'
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// ── App Settings (Entra auth references) ────────────────────────
// AZURE_CLIENT_ID is safe to set via Bicep (not a secret).
// AZURE_CLIENT_SECRET must be set manually via Azure Portal or CLI:
//   az staticwebapp appsettings set -n <swa-name> -g <rg> \
//     --setting-names AZURE_CLIENT_SECRET=<value>

resource appSettings 'Microsoft.Web/staticSites/config@2023-12-01' = if (!empty(entraClientId)) {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    AZURE_CLIENT_ID: entraClientId
  }
}

// ── Custom Domain ───────────────────────────────────────────────
// Prerequisites: CNAME record pointing customDomainHostname → defaultHostname
// For kickstart.aks.azure.sabbour.me → <swa-default>.azurestaticapps.net
// DNS must be verified before this resource can be created.

resource customDomain 'Microsoft.Web/staticSites/customDomains@2023-12-01' = if (!empty(customDomainHostname)) {
  parent: staticWebApp
  name: customDomainHostname
  properties: {}
}

// ── Outputs ─────────────────────────────────────────────────────

@description('Default hostname of the Static Web App')
output defaultHostname string = staticWebApp.properties.defaultHostname

@description('Resource ID of the Static Web App')
output resourceId string = staticWebApp.id

@description('Name of the Static Web App')
output swaName string = staticWebApp.name
