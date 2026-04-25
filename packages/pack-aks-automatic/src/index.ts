import type { Pack, ComponentContribution } from '@aks-kickstart/harness';

// Tools
import { validateManifestsTool } from './tools/validate-manifests.js';
import { validateSafeguardsTool } from './tools/validate-safeguards.js';
import { buildArchitectureDiagramTool } from './tools/build-architecture-diagram.js';

// User actions
import { aksDeployUserAction } from './user-actions/deploy.js';

// Components
import { architectureDiagramContribution } from './components/ArchitectureDiagram/index.js';
import { aksClusterCardContribution } from './components/AksClusterCard/index.js';
import { safeguardViolationsContribution } from './components/SafeguardViolations/index.js';
import { deploymentProgressContribution } from './components/DeploymentProgress/index.js';

// Guardrails
import { noPrivilegedContainersGuardrail } from './guardrails/no-privileged-containers.js';
import { requireResourceLimitsGuardrail } from './guardrails/require-resource-limits.js';
import { noHostpathVolumesGuardrail } from './guardrails/no-hostpath-volumes.js';
import { noLatestTagGuardrail } from './guardrails/no-latest-tag.js';

// Playground scenarios
import { aksClusterCardScenario } from './playground/cluster-card.scenario.js';
import { safeguardViolationsScenario } from './playground/safeguard-violations.scenario.js';

const aksComponents: ComponentContribution[] = [
  architectureDiagramContribution,
  aksClusterCardContribution,
  safeguardViolationsContribution,
  deploymentProgressContribution,
];

export const aksAutomaticPack: Pack = {
  name: 'aks',
  version: '0.1.0',
  dependsOn: ['core', 'azure'],

  // Agents and skills are loaded from directory by the harness registry
  agentsDir: new URL('./agents/', import.meta.url),
  skillsDir: new URL('./skills/', import.meta.url),

  tools: [
    validateManifestsTool,
    validateSafeguardsTool,
    buildArchitectureDiagramTool,
  ],

  userActions: [
    aksDeployUserAction,
  ],

  components: aksComponents,

  guardrails: [
    noPrivilegedContainersGuardrail,
    requireResourceLimitsGuardrail,
    noHostpathVolumesGuardrail,
    noLatestTagGuardrail,
  ],

  playgroundScenarios: [aksClusterCardScenario, safeguardViolationsScenario],
};

// Named exports for individual contributions
export { validateManifestsTool } from './tools/validate-manifests.js';
export { validateSafeguardsTool, SAFEGUARD_RULES } from './tools/validate-safeguards.js';
export { buildArchitectureDiagramTool, buildArchitectureDiagram } from './tools/build-architecture-diagram.js';
export type { PlanInput, DiagramOutput } from './tools/build-architecture-diagram.js';

export { aksDeployUserAction } from './user-actions/deploy.js';

export { architectureDiagramContribution, ArchitectureDiagramSchema } from './components/ArchitectureDiagram/index.js';
export { aksClusterCardContribution } from './components/AksClusterCard/index.js';
export { safeguardViolationsContribution } from './components/SafeguardViolations/index.js';
export { deploymentProgressContribution } from './components/DeploymentProgress/index.js';

export { noPrivilegedContainersGuardrail } from './guardrails/no-privileged-containers.js';
export { requireResourceLimitsGuardrail } from './guardrails/require-resource-limits.js';
export { noHostpathVolumesGuardrail } from './guardrails/no-hostpath-volumes.js';
