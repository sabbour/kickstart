/**
 * Server-safe pack manifest for `azurePack` — no JSX imports.
 *
 * Mirrors `pack-core/src/server-manifest.ts`: tools, user actions, and
 * guardrails are imported directly because they are plain TypeScript with
 * no React dependency. Component contributions are listed by name with
 * placeholder schemas so the server can expose the catalog over
 * `/api/packs` without pulling Fluent UI or React into the Azure Functions
 * bundle.
 *
 * TODO: Extract component schemas from the `.tsx` files into shared
 * non-JSX modules so the server can serve accurate JSON schemas.
 */

import { z } from 'zod';
import type { Pack, ComponentContribution } from '@kickstart/harness';
import { resolveAssetURL } from '@kickstart/harness/runtime/asset-url';

// Tools (no JSX)
import { armGetTool } from './tools/arm-get.js';
import { armDeployResourceTool } from './tools/arm-deploy-resource.js';
import { armDeleteResourceTool } from './tools/arm-delete-resource.js';
import { armUpdateResourceTool } from './tools/arm-update-resource.js';
import { pricingLookupTool } from './tools/pricing-lookup.js';
import { estimateCostTool } from './tools/estimate-cost.js';
import { validateBicepTool } from './tools/validate-bicep.js';
import { whatIfTool } from './tools/what-if.js';

// User actions (no JSX)
import { deployResourceUserAction } from './user-actions/deploy-resource.js';
import { deleteResourceUserAction } from './user-actions/delete-resource.js';
import { updateResourceUserAction } from './user-actions/update-resource.js';
import { deployUserAction } from './user-actions/deploy.js';
import { selectSubscriptionUserAction } from './user-actions/select-subscription.js';

// Guardrails (no JSX)
import { noPrivilegedOperationsGuardrail } from './guardrails/no-privileged-operations.js';
import { requireSubscriptionScopeGuardrail } from './guardrails/require-subscription-scope.js';
import { noHardcodedCredentialsGuardrail } from './guardrails/no-hardcoded-credentials.js';
import { noSubscriptionScopedOwnerGuardrail } from './guardrails/no-subscription-scoped-owner.js';

// ---------------------------------------------------------------------------
// Component contributions (server-safe, no React renderer)
// ---------------------------------------------------------------------------

const AZURE_COMPONENT_NAMES = [
  'AzureResourceCard',
  'CostEstimate',
  'DeploymentStatus',
  'SubscriptionSelector',
  'ResourceGroupSelector',
  'BicepEditor',
  'AzureAction',
  'LocationSelector',
];

const serverComponents: ComponentContribution[] = AZURE_COMPONENT_NAMES.map((name) => ({
  name: `azure/${name}`,
  propertySchema: z.unknown(),
  renderer: null,
}));

// ---------------------------------------------------------------------------
// Server-safe azurePack
// ---------------------------------------------------------------------------

export const azurePackServer: Pack = {
  name: 'azure',
  version: '0.1.0',
  dependsOn: ['core'],

  agentsDir: resolveAssetURL(import.meta.url, './agents/', './pack-assets/azure/agents/'),
  skillsDir: resolveAssetURL(import.meta.url, './skills/', './pack-assets/azure/skills/'),

  tools: [
    armGetTool,
    armDeployResourceTool,
    armDeleteResourceTool,
    armUpdateResourceTool,
    pricingLookupTool,
    estimateCostTool,
    validateBicepTool,
    whatIfTool,
  ],

  userActions: [
    deployResourceUserAction,
    deleteResourceUserAction,
    updateResourceUserAction,
    deployUserAction,
    selectSubscriptionUserAction,
  ],

  components: serverComponents,

  guardrails: [
    noPrivilegedOperationsGuardrail,
    requireSubscriptionScopeGuardrail,
    noHardcodedCredentialsGuardrail,
    noSubscriptionScopedOwnerGuardrail,
  ],
};
