/**
 * Client subpath for `@aks-kickstart/pack-azure` — browser-safe React renderers
 * and preview fixtures for the Azure pack.
 *
 * Consumed by `packages/web` during client bootstrap via `registerClient(target)`.
 * Server-only code (tools, handlers, guardrails) lives in `./server-manifest` and
 * is not re-exported from here.
 *
 * Marked side-effect-free (`sideEffects: false` in package.json) so unused
 * renderers tree-shake out of the initial chunk per route.
 */

import type { ComponentContribution } from '@aks-kickstart/harness';

// Re-export renderers + contributions for direct consumption.
export {
  AzureResourceCardRenderer,
  azureResourceCardContribution,
} from './components/AzureResourceCard/index.js';
export { CostEstimateRenderer, costEstimateContribution } from './components/CostEstimate/index.js';
export {
  DeploymentStatusRenderer,
  deploymentStatusContribution,
} from './components/DeploymentStatus/index.js';
export {
  SubscriptionSelectorRenderer,
  subscriptionSelectorContribution,
} from './components/SubscriptionSelector/index.js';
export {
  ResourceGroupSelectorRenderer,
  resourceGroupSelectorContribution,
} from './components/ResourceGroupSelector/index.js';
export { BicepEditorRenderer, bicepEditorContribution } from './components/BicepEditor/index.js';
export { AzureActionRenderer, azureActionContribution } from './components/AzureAction/index.js';
export {
  LocationSelectorRenderer,
  locationSelectorContribution,
} from './components/LocationSelector/index.js';

import { azureResourceCardContribution } from './components/AzureResourceCard/index.js';
import { costEstimateContribution } from './components/CostEstimate/index.js';
import { deploymentStatusContribution } from './components/DeploymentStatus/index.js';
import { subscriptionSelectorContribution } from './components/SubscriptionSelector/index.js';
import { resourceGroupSelectorContribution } from './components/ResourceGroupSelector/index.js';
import { bicepEditorContribution } from './components/BicepEditor/index.js';
import { azureActionContribution } from './components/AzureAction/index.js';
import { locationSelectorContribution } from './components/LocationSelector/index.js';

/** All Azure pack components eligible for client-side registration. */
export const azureClientComponents: readonly ComponentContribution[] = Object.freeze([
  azureResourceCardContribution,
  costEstimateContribution,
  deploymentStatusContribution,
  subscriptionSelectorContribution,
  resourceGroupSelectorContribution,
  bicepEditorContribution,
  azureActionContribution,
  locationSelectorContribution,
]);

/** Minimal registration target — any object that accepts a `ComponentContribution`. */
export interface PackClientRegisterTarget {
  register(contribution: ComponentContribution): void;
}

/**
 * Register every Azure pack client component with the host registry.
 *
 * Called once at client bootstrap in `packages/web/src/main.tsx` before
 * `clientRegistry.seal()`. Explicit invocation (no import-time side effects)
 * matches the registration contract for `core/*` renderers.
 */
export function registerClient(target: PackClientRegisterTarget): void {
  for (const contribution of azureClientComponents) {
    target.register(contribution);
  }
}

/** Sample A2UI component descriptor array. First entry MUST have `id: 'root'`. */
export type PackPreview = Array<Record<string, unknown>>;

/**
 * Curated scenario composition (Playground Ideas tab — #987).
 *
 * Each scenario is a full A2UI v0.9 adjacency list (2–4 pack components plus
 * any supporting core primitives). The first descriptor MUST have `id: 'root'`.
 * Unlike `previews` (one component in isolation), scenarios demonstrate a
 * realistic user workflow end-to-end.
 *
 * Scenarios are static, build-time-trusted fixtures — same trust bucket as
 * `previews`. No runtime LLM synthesis, no user-supplied envelopes.
 */
export interface PackScenario {
  /** Kebab-case ID, unique within the pack. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly components: ReadonlyArray<Readonly<Record<string, unknown>>>;
}

/**
 * Sample envelopes for Playground previews. Keys are pack-qualified component
 * names (e.g. `'azure/AzureResourceCard'`). Each value is a flat descriptor array
 * suitable for `updateComponents`.
 *
 * Fixtures MUST parse cleanly against the component's `propertySchema` — guarded
 * by the per-pack fixture test.
 */
export const previews: Readonly<Record<string, PackPreview>> = Object.freeze({
  'azure/AzureResourceCard': [
    {
      id: 'root',
      component: 'azure/AzureResourceCard',
      resourceName: 'kickstart-prod-vnet',
      resourceType: 'Microsoft.Network/virtualNetworks',
      location: 'East US',
      resourceGroup: 'rg-kickstart-prod',
      status: 'active',
    },
  ],
  'azure/CostEstimate': [
    {
      id: 'root',
      component: 'azure/CostEstimate',
      totalMonthlyUSD: 248.75,
      currencyCode: 'USD',
      region: 'eastus',
      breakdown: [
        { name: 'AKS cluster', monthlyUSD: 146.0, unitPrice: 0.2, quantity: 730, unitOfMeasure: 'hours' },
        { name: 'Container Registry (Standard)', monthlyUSD: 20.0, unitPrice: 20.0, quantity: 1, unitOfMeasure: 'month' },
        { name: 'Log Analytics (5 GB)', monthlyUSD: 12.5, unitPrice: 2.5, quantity: 5, unitOfMeasure: 'GB' },
      ],
      disclaimer: 'Estimated — actuals may vary by workload.',
    },
  ],
  'azure/DeploymentStatus': [
    {
      id: 'root',
      component: 'azure/DeploymentStatus',
      deploymentName: 'main-2026-04-21',
      provisioningState: 'Succeeded',
      timestamp: '2026-04-21T10:15:00Z',
      subscriptionId: '00000000-0000-0000-0000-000000000000',
      resourceGroup: 'rg-kickstart-prod',
    },
  ],
  'azure/SubscriptionSelector': [
    {
      id: 'root',
      component: 'azure/SubscriptionSelector',
      status: 'loaded',
      subscriptions: [
        { subscriptionId: '00000000-0000-0000-0000-000000000000', displayName: 'Kickstart Prod', state: 'Enabled' },
        { subscriptionId: '11111111-1111-1111-1111-111111111111', displayName: 'Kickstart Dev', state: 'Enabled' },
      ],
      selectedSubscriptionId: '00000000-0000-0000-0000-000000000000',
    },
  ],
  'azure/ResourceGroupSelector': [
    {
      id: 'root',
      component: 'azure/ResourceGroupSelector',
      status: 'loaded',
      subscriptionId: '00000000-0000-0000-0000-000000000000',
      resourceGroups: [
        { name: 'rg-kickstart-prod', location: 'eastus', provisioningState: 'Succeeded' },
        { name: 'rg-kickstart-dev', location: 'westeurope', provisioningState: 'Succeeded' },
      ],
      selectedResourceGroup: 'rg-kickstart-prod',
    },
  ],
  'azure/BicepEditor': [
    {
      id: 'root',
      component: 'azure/BicepEditor',
      templateName: 'main.bicep',
      content:
        "targetScope = 'resourceGroup'\n\nparam location string = resourceGroup().location\n\nresource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {\n  name: 'vnet-kickstart'\n  location: location\n  properties: {\n    addressSpace: { addressPrefixes: [ '10.0.0.0/16' ] }\n  }\n}\n",
      isValid: true,
      errorCount: 0,
      warningCount: 0,
      readOnly: true,
    },
  ],
  'azure/AzureAction': [
    {
      id: 'root',
      component: 'azure/AzureAction',
      title: 'Deploy to Azure',
      description: 'Deploy main.bicep to rg-kickstart-prod',
      status: 'pending',
      resourcePath: '/subscriptions/0.../resourceGroups/rg-kickstart-prod',
      destructive: false,
    },
  ],
  'azure/LocationSelector': [
    {
      id: 'root',
      component: 'azure/LocationSelector',
      status: 'loaded',
      selectedLocation: 'eastus',
      groupByGeography: true,
      locations: [
        { name: 'eastus', displayName: 'East US', regionalDisplayName: '(US) East US', geographyGroup: 'US' },
        { name: 'westeurope', displayName: 'West Europe', regionalDisplayName: '(Europe) West Europe', geographyGroup: 'Europe' },
        { name: 'southeastasia', displayName: 'Southeast Asia', regionalDisplayName: '(Asia Pacific) Southeast Asia', geographyGroup: 'Asia Pacific' },
      ],
    },
  ],
});

/**
 * Curated scenarios for the Playground Ideas tab (#987).
 *
 * Each entry mixes 2–4 components (pack + core primitives) into a realistic
 * user workflow. Consumed by `packages/web/src/catalog/component-scenarios.ts`
 * and rendered via the same engine used for Components tab previews.
 */
export const scenarios: readonly PackScenario[] = Object.freeze([
  {
    id: 'pick-region',
    title: 'Pick an Azure region',
    description: 'Region picker with a primary action button.',
    components: [
      { id: 'root', component: 'Column', children: ['heading', 'selector', 'continue'] },
      { id: 'heading', component: 'Text', text: 'Choose a deployment region' },
      {
        id: 'selector',
        component: 'azure/LocationSelector',
        status: 'loaded',
        selectedLocation: 'eastus',
        groupByGeography: true,
        locations: [
          { name: 'eastus', displayName: 'East US', regionalDisplayName: '(US) East US', geographyGroup: 'US' },
          { name: 'westeurope', displayName: 'West Europe', regionalDisplayName: '(Europe) West Europe', geographyGroup: 'Europe' },
          { name: 'southeastasia', displayName: 'Southeast Asia', regionalDisplayName: '(Asia Pacific) Southeast Asia', geographyGroup: 'Asia Pacific' },
        ],
      },
      { id: 'continue', component: 'Button', child: 'continue-label' },
      { id: 'continue-label', component: 'Text', text: 'Continue' },
    ],
  },
  {
    id: 'scope-deployment',
    title: 'Scope a deployment',
    description: 'Pick the subscription and resource group before deploying.',
    components: [
      { id: 'root', component: 'Column', children: ['subs', 'rgs', 'continue'] },
      {
        id: 'subs',
        component: 'azure/SubscriptionSelector',
        status: 'loaded',
        subscriptions: [
          { subscriptionId: '00000000-0000-0000-0000-000000000000', displayName: 'Kickstart Prod', state: 'Enabled' },
          { subscriptionId: '11111111-1111-1111-1111-111111111111', displayName: 'Kickstart Dev', state: 'Enabled' },
        ],
        selectedSubscriptionId: '00000000-0000-0000-0000-000000000000',
      },
      {
        id: 'rgs',
        component: 'azure/ResourceGroupSelector',
        status: 'loaded',
        subscriptionId: '00000000-0000-0000-0000-000000000000',
        resourceGroups: [
          { name: 'rg-kickstart-prod', location: 'eastus', provisioningState: 'Succeeded' },
          { name: 'rg-kickstart-dev', location: 'westeurope', provisioningState: 'Succeeded' },
        ],
        selectedResourceGroup: 'rg-kickstart-prod',
      },
      { id: 'continue', component: 'Button', child: 'continue-label' },
      { id: 'continue-label', component: 'Text', text: 'Continue' },
    ],
  },
  {
    id: 'review-cost-before-deploy',
    title: 'Review cost before deploying',
    description: 'Show the monthly cost breakdown next to the deploy action.',
    components: [
      { id: 'root', component: 'Card', children: ['wrap'] },
      { id: 'wrap', component: 'Column', children: ['cost', 'action'] },
      {
        id: 'cost',
        component: 'azure/CostEstimate',
        totalMonthlyUSD: 248.75,
        currencyCode: 'USD',
        region: 'eastus',
        breakdown: [
          { name: 'AKS cluster', monthlyUSD: 146.0, unitPrice: 0.2, quantity: 730, unitOfMeasure: 'hours' },
          { name: 'Container Registry (Standard)', monthlyUSD: 20.0, unitPrice: 20.0, quantity: 1, unitOfMeasure: 'month' },
          { name: 'Log Analytics (5 GB)', monthlyUSD: 12.5, unitPrice: 2.5, quantity: 5, unitOfMeasure: 'GB' },
        ],
        disclaimer: 'Estimated — actuals may vary by workload.',
      },
      {
        id: 'action',
        component: 'azure/AzureAction',
        title: 'Deploy to Azure',
        description: 'Deploy main.bicep to rg-kickstart-prod',
        status: 'pending',
        resourcePath: '/subscriptions/0.../resourceGroups/rg-kickstart-prod',
        destructive: false,
      },
    ],
  },
]);
