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

@description('Azure OpenAI endpoint (e.g., https://<name>.openai.azure.com/). Leave empty to skip.')
param openAiEndpoint string = ''

@description('Azure OpenAI chat deployment name (e.g., gpt-5.3-chat)')
param openAiChatDeployment string = ''

@description('Azure OpenAI Codex deployment name for code generation (e.g., gpt-5.3-codex)')
param openAiCodexDeployment string = ''

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

// ── App Settings (Entra auth + OpenAI references) ───────────────
// AZURE_CLIENT_ID and AZURE_OPENAI_* are safe to set via Bicep (not secrets).
// AZURE_CLIENT_SECRET and AZURE_OPENAI_API_KEY must be set manually:
//   az staticwebapp appsettings set -n <swa-name> -g <rg> \
//     --setting-names AZURE_CLIENT_SECRET=<value> AZURE_OPENAI_API_KEY=<value>

resource appSettings 'Microsoft.Web/staticSites/config@2023-12-01' = if (!empty(entraClientId)) {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    AZURE_CLIENT_ID: entraClientId
    AZURE_OPENAI_ENDPOINT: openAiEndpoint
    AZURE_OPENAI_CHAT_DEPLOYMENT: openAiChatDeployment
    AZURE_OPENAI_CODEX_DEPLOYMENT: openAiCodexDeployment
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
