/**
 * @module @kickstart/core/kits/azure-kit
 *
 * AzureKit — bundles Azure-specific tools, connectors, and system-prompt
 * augmentations into a single registerable unit.
 *
 * Provided tools:
 *   - azure_resource_list  (discover existing resources before recommending)
 *   - azure_resource_get   (inspect a specific resource's configuration)
 *   - estimate_cost        (budget estimation before deployment)
 *
 * Provided connectors:
 *   - AzureARMConnector    (Azure Resource Manager REST API)
 *   - PricingConnector     (Azure Retail Pricing API, no auth required)
 *
 * Component registrations (rendered by packages/web):
 *   - azureLoginCard       (MSAL sign-in card with subscription auto-select)
 *   - azureResourcePicker  (dropdown populated from ARM at render time)
 */

import type { IntegrationKit } from './types.js';
import { azureResourceList } from '../tools/azure-resource-list.js';
import { azureResourceGet } from '../tools/azure-resource-get.js';
import { estimateCost } from '../tools/estimate-cost.js';
import { AzureARMConnector } from '../connectors/AzureARMConnector.js';
import { PricingConnector } from '../connectors/PricingConnector.js';

export const azureKit: IntegrationKit = {
  name: 'azure',
  description:
    'Azure integration kit — ARM resource discovery, cost estimation, and AKS deployment guidance.',

  tools: [
    azureResourceList,
    azureResourceGet,
    estimateCost,
  ],

  connectors: [
    new AzureARMConnector(),
    new PricingConnector(),
  ],

  prompts: [
    // AKS Automatic domain knowledge
    'When recommending AKS deployments, always prefer AKS Automatic (aksAutomatic) over manual cluster configuration. ' +
    'AKS Automatic manages node provisioning, scaling, and upgrades without user intervention.',

    // Resource discovery guidance
    'Before recommending new Azure resources, use azure_resource_list to discover what already exists in the ' +
    'target subscription. Re-use existing AKS clusters and ACR registries whenever appropriate.',

    // Cost transparency
    'When the user asks about cost or before proposing a deployment plan, use estimate_cost to provide a ' +
    'monthly budget estimate. Always surface the cost breakdown (compute, networking, storage, database).',

    // Deployment safeguards
    'Never expose Kubernetes YAML or kubectl commands directly to the user. Translate all infrastructure ' +
    'operations into plain-language deployment steps. K8s complexity is hidden behind AKS Automatic.',
  ],

  components: [
    {
      type: 'azureLoginCard',
      description: 'MSAL sign-in card with automatic subscription selection',
    },
    {
      type: 'azureResourcePicker',
      description: 'Dropdown populated from ARM API at render time (regions, resource groups, SKUs)',
    },
  ],
};
