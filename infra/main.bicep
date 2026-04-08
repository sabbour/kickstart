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
      appLocation: 'packages/web'
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// ── Outputs ─────────────────────────────────────────────────────

@description('Default hostname of the Static Web App')
output defaultHostname string = staticWebApp.properties.defaultHostname

@description('Resource ID of the Static Web App')
output resourceId string = staticWebApp.id

@description('Name of the Static Web App')
output swaName string = staticWebApp.name
