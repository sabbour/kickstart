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

var applicationInsightsName = '${swaName}-appi'
var logAnalyticsWorkspaceName = 'log-${swaName}'

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

// ── Monitoring ──────────────────────────────────────────────────

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  properties: {
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    Flow_Type: 'Bluefield'
    Request_Source: 'rest'
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

var applicationInsightsSetting = {
  APPLICATIONINSIGHTS_CONNECTION_STRING: applicationInsights.properties.ConnectionString
}

var entraClientIdSetting = !empty(entraClientId)
  ? {
      AZURE_CLIENT_ID: entraClientId
      AZURE_TENANT_ID: subscription().tenantId
    }
  : {}

var openAiEndpointSetting = !empty(openAiEndpoint)
  ? {
      AZURE_OPENAI_ENDPOINT: openAiEndpoint
    }
  : {}

var openAiChatDeploymentSetting = !empty(openAiChatDeployment)
  ? {
      AZURE_OPENAI_CHAT_DEPLOYMENT: openAiChatDeployment
    }
  : {}

var openAiCodexDeploymentSetting = !empty(openAiCodexDeployment)
  ? {
      AZURE_OPENAI_CODEX_DEPLOYMENT: openAiCodexDeployment
    }
  : {}

var openAiInspireDeploymentSetting = !empty(openAiInspireDeployment)
  ? {
      AZURE_OPENAI_INSPIRE_DEPLOYMENT: openAiInspireDeployment
    }
  : {}

var clientSecretSetting = !empty(entraClientSecret)
  ? { AZURE_CLIENT_SECRET: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/entra-client-secret)' }
  : {}

var apiKeySetting = !empty(openAiApiKey)
  ? { AZURE_OPENAI_API_KEY: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/openai-api-key)' }
  : {}

resource appSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: union(
    applicationInsightsSetting,
    entraClientIdSetting,
    openAiEndpointSetting,
    openAiChatDeploymentSetting,
    openAiCodexDeploymentSetting,
    openAiInspireDeploymentSetting,
    clientSecretSetting,
    apiKeySetting
  )
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

@description('Name of the Application Insights resource')
output applicationInsightsName string = applicationInsights.name

@description('Name of the Log Analytics workspace backing Application Insights')
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name
