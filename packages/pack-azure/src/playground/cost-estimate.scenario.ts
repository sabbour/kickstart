import type { PlaygroundScenario } from '@kickstart/harness';
import { A2UI_VERSION } from '@kickstart/harness';

/**
 * Playground scenario: azure.cost-estimate
 * Renders the azure/CostEstimate component with a plausible AKS + ACR + Key Vault breakdown.
 */
export const costEstimateScenario: PlaygroundScenario = {
  id: 'azure.cost-estimate',
  title: 'Azure Cost Estimate',
  description: 'Shows the CostEstimate component with a line-item breakdown for a small AKS Automatic deployment.',
  group: 'azure',
  a2ui: [
    {
      version: A2UI_VERSION,
      createSurface: { surfaceId: 'azure-cost-estimate', catalogId: 'kickstart' },
    },
    {
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId: 'azure-cost-estimate',
        components: [
          {
            type: 'azure/CostEstimate',
            totalMonthlyUSD: 312.4,
            currencyCode: 'USD',
            region: 'East US',
            disclaimer: 'Estimates are based on Azure retail pricing and do not include data egress.',
            breakdown: [
              {
                name: 'AKS Automatic control plane (Standard tier)',
                monthlyUSD: 73.0,
                unitPrice: 0.1,
                quantity: 730,
                unitOfMeasure: 'hours',
              },
              {
                name: 'Standard_D4s_v5 node pool (3 nodes)',
                monthlyUSD: 210.24,
                unitPrice: 0.096,
                quantity: 2190,
                unitOfMeasure: 'vCPU-hours',
              },
              {
                name: 'Azure Container Registry (Standard)',
                monthlyUSD: 20.0,
                unitPrice: 20.0,
                quantity: 1,
                unitOfMeasure: 'registry/month',
              },
              {
                name: 'Azure Key Vault (standard operations)',
                monthlyUSD: 9.16,
                unitPrice: 0.03,
                quantity: 305,
                unitOfMeasure: '10K ops',
              },
            ],
          },
        ],
      },
    },
  ],
};
