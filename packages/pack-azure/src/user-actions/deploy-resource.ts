import { z } from 'zod';
import type { UserActionContribution } from '@aks-kickstart/harness';

/**
 * azure:deploy-resource user action.
 *
 * Triggers creation or re-deployment of a specific Azure resource via ARM PUT
 * after explicit user confirmation. The browser posts the confirmed payload to
 * /api/converse/resume. The runner performs the actual ARM PUT.
 *
 * The component NEVER calls ARM directly from the browser.
 */

const DeployResourceParametersSchema = z.object({
  resourcePath: z
    .string()
    .describe('Full ARM resource path, e.g. /subscriptions/{uuid}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/{name}'),
  apiVersion: z
    .string()
    .describe('ARM API version, e.g. "2023-03-01"'),
  resourceType: z
    .string()
    .describe('ARM resource type, e.g. "Microsoft.Compute/virtualMachines"'),
  resourceName: z
    .string()
    .describe('Display name of the resource being deployed'),
  // OpenAI strict-mode forbids open-keyed objects (z.record). The body is
  // passed as a JSON-encoded string; the runner forwards it verbatim to
  // azure.arm_deploy_resource which performs the JSON parse + ARM PUT.
  body: z
    .string()
    .describe('Full ARM resource body for the PUT request, JSON-encoded as a string'),
  confirmationMessage: z
    .string()
    .describe('Human-readable description of what this deployment will do, shown in the confirm UI'),
});

const DeployResourceResultSchema = z.object({
  confirmed: z.boolean(),
  resourceId: z.string().optional(),
  provisioningState: z.string().optional(),
  location: z.string().optional(),
  error: z.string().optional(),
});

export const deployResourceUserAction: UserActionContribution = {
  name: 'azure:deploy-resource',
  wireName: 'azure__deploy_resource',
  description:
    'Creates or re-deploys a specific Azure resource via ARM PUT after explicit user confirmation. ' +
    'Use for individual resource creation (VM, storage account, etc.). ' +
    'For full template deployments use azure:deploy.',
  parameters: DeployResourceParametersSchema,
  resultSchema: DeployResourceResultSchema,
  confirmComponent: {
    component: 'azure/AzureAction',
    props: {},
  },
  scopes: ['https://management.azure.com/.default'],
  cancellation: 'supported',
};
