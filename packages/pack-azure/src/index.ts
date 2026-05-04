import type { Pack, ComponentContribution } from '@aks-kickstart/harness';

// Tools
import { armGetTool } from './tools/arm-get.js';
import { armDeployResourceTool } from './tools/arm-deploy-resource.js';
import { armDeleteResourceTool } from './tools/arm-delete-resource.js';
import { armUpdateResourceTool } from './tools/arm-update-resource.js';
import { pricingLookupTool } from './tools/pricing-lookup.js';
import { estimateCostTool } from './tools/estimate-cost.js';
import { validateBicepTool } from './tools/validate-bicep.js';
import { whatIfTool } from './tools/what-if.js';
import { proposeServicesTool } from './tools/propose-services.js';
import { quotaLookupTool } from './tools/quota-lookup.js';
import { assessAksClusterTool } from './tools/assess-aks-cluster.js';

// User actions
import { deployResourceUserAction } from './user-actions/deploy-resource.js';
import { deleteResourceUserAction } from './user-actions/delete-resource.js';
import { updateResourceUserAction } from './user-actions/update-resource.js';
import { deployUserAction } from './user-actions/deploy.js';
import { selectSubscriptionUserAction } from './user-actions/select-subscription.js';

// Components
import { azureResourceCardContribution } from './components/AzureResourceCard/index.js';
import { costEstimateContribution } from './components/CostEstimate/index.js';
import { deploymentStatusContribution } from './components/DeploymentStatus/index.js';
import { subscriptionSelectorContribution } from './components/SubscriptionSelector/index.js';
import { resourceGroupSelectorContribution } from './components/ResourceGroupSelector/index.js';
import { bicepEditorContribution } from './components/BicepEditor/index.js';
import { azureActionContribution } from './components/AzureAction/index.js';
import { locationSelectorContribution } from './components/LocationSelector/index.js';

// Guardrails
import { noPrivilegedOperationsGuardrail } from './guardrails/no-privileged-operations.js';
import { requireSubscriptionScopeGuardrail } from './guardrails/require-subscription-scope.js';
import { noHardcodedCredentialsGuardrail } from './guardrails/no-hardcoded-credentials.js';
import { noSubscriptionScopedOwnerGuardrail } from './guardrails/no-subscription-scoped-owner.js';

// Playground scenarios
import { azureResourceCardScenario } from './playground/resource-card.scenario.js';
import { costEstimateScenario } from './playground/cost-estimate.scenario.js';

const azureComponents: ComponentContribution[] = [
  azureResourceCardContribution,
  costEstimateContribution,
  deploymentStatusContribution,
  subscriptionSelectorContribution,
  resourceGroupSelectorContribution,
  bicepEditorContribution,
  azureActionContribution,
  locationSelectorContribution,
];

export const azurePack: Pack = {
  name: 'azure',
  version: '0.1.0',
  dependsOn: ['core'],

  // Agents and skills are loaded from directory by the harness registry
  agentsDir: new URL('./agents/', import.meta.url),
  skillsDir: new URL('./skills/', import.meta.url),

  tools: [
    armGetTool,
    armDeployResourceTool,
    armDeleteResourceTool,
    armUpdateResourceTool,
    pricingLookupTool,
    estimateCostTool,
    validateBicepTool,
    whatIfTool,
    proposeServicesTool,
    quotaLookupTool,
    assessAksClusterTool,
  ],

  userActions: [
    deployResourceUserAction,
    deleteResourceUserAction,
    updateResourceUserAction,
    deployUserAction,
    selectSubscriptionUserAction,
  ],

  components: azureComponents,

  guardrails: [
    noPrivilegedOperationsGuardrail,
    requireSubscriptionScopeGuardrail,
    noHardcodedCredentialsGuardrail,
    noSubscriptionScopedOwnerGuardrail,
  ],

  playgroundScenarios: [azureResourceCardScenario, costEstimateScenario],
};

// Named exports for individual contributions
export { armGetTool, validateArmPath, ARM_PATH_RE, ARM_PATH_DENY } from './tools/arm-get.js';
export { armDeployResourceTool } from './tools/arm-deploy-resource.js';
export { armDeleteResourceTool } from './tools/arm-delete-resource.js';
export { armUpdateResourceTool } from './tools/arm-update-resource.js';
export { pricingLookupTool } from './tools/pricing-lookup.js';
export { estimateCostTool } from './tools/estimate-cost.js';
export { validateBicepTool } from './tools/validate-bicep.js';
export { whatIfTool } from './tools/what-if.js';
export { proposeServicesTool, GPU_SKU_MATRIX, SUPPORTED_MODEL_SIZES } from './tools/propose-services.js';
export { quotaLookupTool, buildQuotaRequestUrl, findSkuUsage } from './tools/quota-lookup.js';
export { assessAksClusterTool, assessAutomaticCompatibility } from './tools/assess-aks-cluster.js';

export { deployResourceUserAction } from './user-actions/deploy-resource.js';
export { deleteResourceUserAction } from './user-actions/delete-resource.js';
export { updateResourceUserAction } from './user-actions/update-resource.js';
export { deployUserAction } from './user-actions/deploy.js';
export { selectSubscriptionUserAction } from './user-actions/select-subscription.js';

export { azureResourceCardContribution } from './components/AzureResourceCard/index.js';
export { costEstimateContribution } from './components/CostEstimate/index.js';
export { deploymentStatusContribution } from './components/DeploymentStatus/index.js';
export { subscriptionSelectorContribution } from './components/SubscriptionSelector/index.js';
export { resourceGroupSelectorContribution } from './components/ResourceGroupSelector/index.js';
export { bicepEditorContribution } from './components/BicepEditor/index.js';
export { azureActionContribution } from './components/AzureAction/index.js';
export { locationSelectorContribution } from './components/LocationSelector/index.js';

export { noPrivilegedOperationsGuardrail } from './guardrails/no-privileged-operations.js';
export { requireSubscriptionScopeGuardrail } from './guardrails/require-subscription-scope.js';
export { noHardcodedCredentialsGuardrail } from './guardrails/no-hardcoded-credentials.js';
export { noSubscriptionScopedOwnerGuardrail } from './guardrails/no-subscription-scoped-owner.js';

export { getAzureToken, armAuthHeaders, armBaseUrl, armUrl, pollArmLro, assertArmPollingUrl, ARM_POLLING_HOSTS } from './services/azure-auth.js';
export { getDeploymentStatus, listDeployments, waitForDeployment } from './services/azure-deployments.js';
