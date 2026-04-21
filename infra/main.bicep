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

@description('Azure OpenAI non-coding chat deployment name (e.g., gpt-5.4-mini)')
param openAiChatDeployment string = ''

@description('Azure OpenAI coding/generate deployment name (e.g., gpt-5.4)')
param openAiCodexDeployment string = ''

@description('Azure OpenAI deployment for inspiration generation (e.g., gpt-5.4-nano). Falls back to chat deployment if empty.')
param openAiInspireDeployment string = ''

@description('Name of the Key Vault for secret storage (must be globally unique, 3-24 alphanumeric chars and hyphens)')
param keyVaultName string = 'kv-kickstart'

@secure()
@description('Azure OpenAI API key. When provided, stored in Key Vault and referenced by SWA.')
param openAiApiKey string = ''

@secure()
@description('Entra ID client secret. When provided, stored in Key Vault and referenced by SWA.')
param entraClientSecret string = ''


@description('Name of the Log Analytics workspace (must be globally unique)')
param logAnalyticsWorkspaceName string = 'law-kickstart'

@description('Name of the Application Insights component (must be globally unique)')
param appInsightsName string = 'ai-kickstart'


// ── Key Vault ───────────────────────────────────────────────────

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
  }
}

resource secretOpenAiApiKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(openAiApiKey)) {
  parent: keyVault
  name: 'openai-api-key'
  properties: {
    value: openAiApiKey
    contentType: 'text/plain'
  }
}

resource secretEntraClientSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(entraClientSecret)) {
  parent: keyVault
  name: 'entra-client-secret'
  properties: {
    value: entraClientSecret
    contentType: 'text/plain'
  }
}

// ── Log Analytics Workspace ─────────────────────────────────────

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ── Application Insights ────────────────────────────────────────

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ── Static Web App ──────────────────────────────────────────────

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: location
  sku: {
    name: skuName
    tier: skuName
  }
  identity: {
    type: 'SystemAssigned'
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

// ── Key Vault RBAC — SWA reads secrets via managed identity ─────
// Role: Key Vault Secrets User (4633458b-17de-408a-b874-0445c86b69e6)

resource kvSecretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, staticWebApp.id, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    principalId: staticWebApp.identity.principalId
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '4633458b-17de-408a-b874-0445c86b69e6'
    )
    principalType: 'ServicePrincipal'
  }
}

// ── App Settings ────────────────────────────────────────────────
// Non-secret config is set directly. Secrets use Key Vault references
// so that secret values never appear in SWA config or ARM state.

var baseAppSettings = {
  AZURE_CLIENT_ID: entraClientId
  AZURE_TENANT_ID: subscription().tenantId
  AZURE_OPENAI_ENDPOINT: openAiEndpoint
  AZURE_OPENAI_CHAT_DEPLOYMENT: openAiChatDeployment
  AZURE_OPENAI_CODEX_DEPLOYMENT: openAiCodexDeployment
  AZURE_OPENAI_INSPIRE_DEPLOYMENT: openAiInspireDeployment
  APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
}

var clientSecretSetting = !empty(entraClientSecret)
  ? { AZURE_CLIENT_SECRET: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/entra-client-secret)' }
  : {}

var apiKeySetting = !empty(openAiApiKey)
  ? { AZURE_OPENAI_API_KEY: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/openai-api-key)' }
  : {}

resource appSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: union(baseAppSettings, clientSecretSetting, apiKeySetting)
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

@description('Key Vault name for secret management')
output keyVaultName string = keyVault.name

@description('Key Vault URI')
output keyVaultUri string = keyVault.properties.vaultUri

@description('Application Insights name')
output appInsightsName string = appInsights.name

@description('Application Insights connection string (contains the ingestion endpoint and instrumentation key)')
@secure()
output appInsightsConnectionString string = appInsights.properties.ConnectionString

@description('Application Insights instrumentation key')
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
