/**
 * Client subpath for `@aks-kickstart/pack-aks-automatic` — browser-safe React
 * renderers and preview fixtures for the AKS pack.
 *
 * See `pack-azure/client.ts` for the contract.
 */

import type { ComponentContribution } from '@aks-kickstart/harness';

export {
  AksClusterCardRenderer,
  aksClusterCardContribution,
} from './components/AksClusterCard/index.js';
export {
  ArchitectureDiagramRenderer,
  architectureDiagramContribution,
} from './components/ArchitectureDiagram/index.js';
export {
  DeploymentProgressRenderer,
  deploymentProgressContribution,
} from './components/DeploymentProgress/index.js';
export {
  SafeguardViolationsRenderer,
  safeguardViolationsContribution,
} from './components/SafeguardViolations/index.js';

import { aksClusterCardContribution } from './components/AksClusterCard/index.js';
import { architectureDiagramContribution } from './components/ArchitectureDiagram/index.js';
import { deploymentProgressContribution } from './components/DeploymentProgress/index.js';
import { safeguardViolationsContribution } from './components/SafeguardViolations/index.js';

/** All AKS pack components eligible for client-side registration. */
export const aksClientComponents: readonly ComponentContribution[] = Object.freeze([
  aksClusterCardContribution,
  architectureDiagramContribution,
  deploymentProgressContribution,
  safeguardViolationsContribution,
]);

export interface PackClientRegisterTarget {
  register(contribution: ComponentContribution): void;
}

export function registerClient(target: PackClientRegisterTarget): void {
  for (const contribution of aksClientComponents) {
    target.register(contribution);
  }
}

export type PackPreview = Array<Record<string, unknown>>;

export const previews: Readonly<Record<string, PackPreview>> = Object.freeze({
  'aks/AksClusterCard': [
    {
      id: 'root',
      component: 'aks/AksClusterCard',
      clusterName: 'aks-kickstart-prod',
      resourceGroup: 'rg-kickstart-prod',
      location: 'East US',
      kubernetesVersion: '1.30.0',
      nodeCount: 3,
      status: 'Running',
      tier: 'Standard',
      fqdn: 'aks-kickstart-prod-abc123.hcp.eastus.azmk8s.io',
    },
  ],
  'aks/ArchitectureDiagram': [
    {
      id: 'root',
      component: 'aks/ArchitectureDiagram',
      title: 'Kickstart sample topology',
      description: 'High-level view of the deployed services.',
      nodes: [
        { id: 'user', label: 'User', type: 'actor' },
        { id: 'ingress', label: 'Ingress', type: 'network' },
        { id: 'api', label: 'API (Container App)', type: 'service' },
        { id: 'db', label: 'PostgreSQL Flexible', type: 'datastore' },
      ],
      edges: [
        { from: 'user', to: 'ingress', label: 'HTTPS' },
        { from: 'ingress', to: 'api' },
        { from: 'api', to: 'db', label: 'TCP/5432' },
      ],
    },
  ],
  'aks/DeploymentProgress': [
    {
      id: 'root',
      component: 'aks/DeploymentProgress',
      clusterName: 'aks-kickstart-prod',
      resourceGroup: 'rg-kickstart-prod',
      subscription: 'Kickstart Prod',
      phase: 'provisioning',
      message: 'Provisioning system node pool…',
      progressPercent: 55,
      startedAt: '2026-04-21T10:00:00Z',
      steps: [
        { name: 'Validate template', status: 'succeeded' },
        { name: 'Create resource group', status: 'succeeded' },
        { name: 'Create AKS cluster', status: 'running', message: 'Creating node pool' },
        { name: 'Install platform workloads', status: 'pending' },
      ],
    },
  ],
  'aks/SafeguardViolations': [
    {
      id: 'root',
      component: 'aks/SafeguardViolations',
      manifestName: 'api-deployment.yaml',
      compliant: false,
      summary: '2 violations found — 1 high, 1 medium',
      violations: [
        {
          ruleId: 'no-privileged-containers',
          severity: 'high',
          description: 'Container runs with securityContext.privileged=true',
          line: 27,
        },
        {
          ruleId: 'require-resource-limits',
          severity: 'medium',
          description: 'Container is missing resources.limits',
          line: 34,
        },
      ],
    },
  ],
});
