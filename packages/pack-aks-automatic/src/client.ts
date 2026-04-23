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

/**
 * Curated scenario composition (Playground Ideas tab — #987).
 * See `pack-azure/client.ts` for the contract.
 */
export interface PackScenario {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly components: ReadonlyArray<Readonly<Record<string, unknown>>>;
}

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

/**
 * Curated scenarios for the Playground Ideas tab (#987).
 *
 * Each entry composes pack AKS components with core primitives into a
 * realistic end-to-end workflow. Rendered via the same engine as
 * Components-tab previews.
 */
export const scenarios: readonly PackScenario[] = Object.freeze([
  {
    id: 'cluster-overview',
    title: 'Review cluster overview',
    description: 'Cluster summary card alongside the architecture diagram.',
    components: [
      { id: 'root', component: 'Column', children: ['heading', 'card', 'diagram'] },
      { id: 'heading', component: 'Text', text: 'aks-kickstart-prod overview' },
      {
        id: 'card',
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
      {
        id: 'diagram',
        component: 'aks/ArchitectureDiagram',
        title: 'Deployed topology',
        nodes: [
          { id: 'user', label: 'User', type: 'external' },
          { id: 'ingress', label: 'Ingress', type: 'gateway' },
          { id: 'api', label: 'API', type: 'service' },
          { id: 'db', label: 'Postgres', type: 'datastore' },
        ],
        edges: [
          { from: 'user', to: 'ingress', label: 'HTTPS' },
          { from: 'ingress', to: 'api' },
          { from: 'api', to: 'db', label: 'TCP/5432' },
        ],
      },
    ],
  },
  {
    id: 'monitor-deployment',
    title: 'Monitor a deployment in flight',
    description: 'Progress steps with a status alert.',
    components: [
      { id: 'root', component: 'Column', children: ['progress', 'alert'] },
      {
        id: 'progress',
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
      {
        id: 'alert',
        component: 'Alert',
        message: 'Provisioning is in progress. This usually takes 5–10 minutes.',
        severity: 'info',
      },
    ],
  },
  {
    id: 'safeguard-review',
    title: 'Review safeguard violations',
    description: 'Violations list plus fix/override actions.',
    components: [
      { id: 'root', component: 'Column', children: ['heading', 'violations', 'actions'] },
      { id: 'heading', component: 'Text', text: 'Deploy blocked by safeguards' },
      {
        id: 'violations',
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
      { id: 'actions', component: 'Row', children: ['fix', 'override'] },
      { id: 'fix', component: 'Button', child: 'fix-label' },
      { id: 'fix-label', component: 'Text', text: 'Fix automatically' },
      { id: 'override', component: 'Button', child: 'override-label' },
      { id: 'override-label', component: 'Text', text: 'Override and deploy' },
    ],
  },
]);
