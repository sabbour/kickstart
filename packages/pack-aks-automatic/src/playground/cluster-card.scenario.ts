import type { PlaygroundScenario } from '@aks-kickstart/harness';
import { A2UI_VERSION } from '@aks-kickstart/harness';

/**
 * Playground scenario: aks.cluster-card
 * Renders the aks/AksClusterCard component for a provisioned AKS Automatic cluster.
 */
export const aksClusterCardScenario: PlaygroundScenario = {
  id: 'aks.cluster-card',
  title: 'AKS Cluster Card',
  description: 'Shows the AksClusterCard component for a small AKS Automatic cluster in East US.',
  group: 'aks',
  a2ui: [
    {
      version: A2UI_VERSION,
      createSurface: { surfaceId: 'aks-cluster-card', catalogId: 'kickstart' },
    },
    {
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId: 'aks-cluster-card',
        components: [
          {
            type: 'aks/AksClusterCard',
            clusterName: 'aks-kickstart-eastus',
            resourceGroup: 'rg-kickstart-prod',
            location: 'East US',
            kubernetesVersion: '1.30.0',
            nodeCount: 3,
            tier: 'Standard',
            fqdn: 'aks-kickstart-eastus-a1b2c3.hcp.eastus.azmk8s.io',
          },
        ],
      },
    },
  ],
};
