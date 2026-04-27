import { z } from 'zod';
import type { UserActionContribution } from '@aks-kickstart/harness';

/**
 * deploy user action.
 *
 * Triggers an ARM template deployment after user confirmation.
 * The browser shows deployment details via AzureAction confirm gate.
 * On confirmation, the server runner creates the ARM deployment resource.
 */

const DeployParametersSchema = z.object({
  scopePath: z
    .string()
    .describe('ARM scope path (resource group or subscription level)'),
  deploymentName: z
    .string()
    .describe('Deployment name for tracking in Azure'),
  // OpenAI strict-mode forbids open-keyed objects (z.record). The template
  // and parameters are passed as JSON-encoded strings.
  template: z
    .string()
    .describe('ARM JSON template object to deploy, encoded as a JSON string'),
  parameters: z
    .string()
    .nullable()
    .optional()
    .describe('ARM template parameters, encoded as a JSON string'),
  whatIfSummary: z
    .string()
    .nullable()
    .optional()
    .describe('Pre-computed what-if summary to show in the confirm UI'),
});

const DeployResultSchema = z.object({
  confirmed: z.boolean(),
  deploymentId: z.string().optional(),
  deploymentName: z.string().optional(),
  provisioningState: z.string().optional(),
  outputs: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
});

export const deployUserAction: UserActionContribution = {
  name: 'azure:deploy',
  wireName: 'azure__deploy',
  description:
    'Deploys an ARM template to Azure after explicit user confirmation. ' +
    'Shows a what-if summary and deployment details in the confirm UI. ' +
    'Always run azure.what_if first to populate whatIfSummary.',
  parameters: DeployParametersSchema,
  resultSchema: DeployResultSchema,
  confirmComponent: {
    component: 'azure/AzureAction',
    props: {},
  },
  scopes: ['https://management.azure.com/.default'],
  cancellation: 'supported',
};
