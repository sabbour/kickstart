import { z } from 'zod';
import type { UserActionContribution } from '@aks-kickstart/harness';

/**
 * aks:deploy user action.
 *
 * Confirm gate for AKS cluster and workload deployments.
 * The browser surfaces cluster details via the DeploymentProgress confirm component.
 * On user confirmation, the server runner executes the `az aks` deployment.
 *
 * resultSchema enforces a typed confirm payload — cluster name, resource group,
 * and subscription are required to prevent ambiguous deployments.
 */

const AksDeployParametersSchema = z.object({
  clusterName: z
    .string()
    .min(1)
    .describe('AKS cluster name to deploy to'),
  resourceGroup: z
    .string()
    .min(1)
    .describe('Azure resource group containing the cluster'),
  subscription: z
    .string()
    .min(1)
    .describe('Azure subscription ID or name'),
  namespace: z
    .string()
    .optional()
    .describe('Kubernetes namespace for workload deployments (default: default)'),
  manifests: z
    .array(z.string())
    .optional()
    .describe('Kubernetes YAML manifests to apply after cluster is ready'),
  deploymentSummary: z
    .string()
    .optional()
    .describe('Human-readable summary of what will be deployed — shown in the confirm UI'),
  safeguardReport: z
    .string()
    .optional()
    .describe('Pre-computed safeguard compliance report to display in the confirm UI'),
});

const AksDeployResultSchema = z.object({
  confirmed: z.boolean(),
  clusterName: z.string(),
  resourceGroup: z.string(),
  subscription: z.string(),
  provisioningState: z.string().optional(),
  fqdn: z.string().optional(),
  error: z.string().optional(),
});

export const aksDeployUserAction: UserActionContribution = {
  name: 'aks:deploy',
  wireName: 'aks__deploy',
  description:
    'Deploys an AKS cluster or applies Kubernetes manifests after explicit user confirmation. ' +
    'Shows cluster details, resource group, and a safeguard compliance report in the confirm UI. ' +
    'Always run aks.validate_manifests and aks.validate_safeguards first. ' +
    'High-severity safeguard violations must be resolved before calling this action.',
  parameters: AksDeployParametersSchema,
  resultSchema: AksDeployResultSchema,
  confirmComponent: {
    component: 'aks/DeploymentProgress',
    props: {},
  },
  cancellation: 'supported',
};
