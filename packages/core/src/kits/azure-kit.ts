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
import { Phase } from '../engine/types.js';
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
    // AKS Automatic domain knowledge (general — all phases)
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

  phasePrompts: {
    [Phase.Discover]: [
      'Call azure_resource_list early if the user mentions they have an Azure subscription. ' +
      'This lets you discover existing AKS clusters and ACR registries so you can re-use them rather than recommending new ones. ' +
      'Never ask "do you have existing Azure resources?" — just check.',
    ],

    [Phase.Design]: [
      'Prefer AKS Automatic (sku: Automatic, tier: Standard) for all new deployments. ' +
      'Recommend managed Azure services: Azure Database for PostgreSQL, Azure Cache for Redis, Azure Service Bus, Azure AI Search. ' +
      'Use azure_resource_list to discover existing resources before proposing new ones. ' +
      'Present the architecture with ArchitectureDiagram + CostEstimate using estimate_cost tool output.',
    ],

    [Phase.Generate]: [
      'Generate AKS Automatic-compatible deployment files. Required elements for every app:\n' +
      '  • Gateway API: GatewayClass "approuting-istio", Gateway + HTTPRoute (never legacy Ingress)\n' +
      '  • Workload Identity: User-Assigned Managed Identity + Federated Credential (never connection strings)\n' +
      '  • ACR integration: AcrPull role binding for kubelet (never imagePullSecrets)\n' +
      '  • HPA: min 2 replicas, max 10, CPU threshold 70%\n' +
      '  • PDB: minAvailable 1\n' +
      'Do NOT set dnsPrefix, networkProfile, or nodeResourceGroup on the AKS Automatic cluster resource.',
    ],

    [Phase.Review]: [
      'Use estimate_cost to provide a final monthly cost breakdown before the user approves the plan. ' +
      'Present costs as a CostEstimate component (compute, database, networking, storage line items). ' +
      'Validate all generated files against deployment safeguards — surface violations as "deployment improvements" not "Kubernetes issues".',
    ],

    [Phase.Handoff]: [
      'After code is pushed to GitHub, remind the user that the GitHub Actions workflow will deploy ' +
      'automatically on every push to the default branch. No manual Azure steps needed. ' +
      'The workflow uses OIDC Workload Identity — no secrets to configure.',
    ],

    [Phase.Deploy]: [
      'Use azure_resource_list to confirm the target subscription and resource group before deploying. ' +
      'Use azure_resource_get to check AKS cluster status if the user already has one. ' +
      'Show a DeploymentProgress component tracking: image build → push to ACR → AKS rolling update → health check.',
    ],
  },

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
