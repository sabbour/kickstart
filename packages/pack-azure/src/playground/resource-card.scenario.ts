import type { PlaygroundScenario } from '@aks-kickstart/harness';
import { A2UI_VERSION } from '@aks-kickstart/harness';

/**
 * Playground scenario: azure.resource-card
 * Renders the azure/AzureResourceCard component for a provisioned AKS cluster.
 */
export const azureResourceCardScenario: PlaygroundScenario = {
  id: 'azure.resource-card',
  title: 'Azure Resource Card',
  description: 'Shows the AzureResourceCard component for an active AKS cluster with tags and key properties.',
  group: 'azure',
  a2ui: [
    {
      version: A2UI_VERSION,
      createSurface: { surfaceId: 'azure-resource-card', catalogId: 'kickstart' },
    },
    {
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId: 'azure-resource-card',
        components: [
          {
            type: 'azure/AzureResourceCard',
            resourceName: 'aks-kickstart-eastus',
            resourceType: 'Microsoft.ContainerService/managedClusters',
            location: 'East US',
            resourceGroup: 'rg-kickstart-prod',
            status: 'active',
            tags: {
              env: 'prod',
              owner: 'platform-team',
              costCenter: 'CC-1001',
            },
            properties: {
              sku: 'Automatic',
              kubernetesVersion: '1.30.0',
              nodeCount: 3,
              fqdn: 'aks-kickstart-eastus-a1b2c3.hcp.eastus.azmk8s.io',
            },
          },
        ],
      },
    },
  ],
};
