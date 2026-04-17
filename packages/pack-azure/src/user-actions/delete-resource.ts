import { z } from 'zod';
import type { UserActionContribution } from '@kickstart/harness';

/**
 * azure:delete-resource user action.
 *
 * Triggers deletion of a specific Azure resource via ARM DELETE after explicit
 * user confirmation. The browser posts the confirmed payload to
 * /api/converse/resume. The runner performs the actual ARM DELETE.
 *
 * The component NEVER calls ARM directly from the browser.
 */

const DeleteResourceParametersSchema = z.object({
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
    .describe('Display name of the resource to delete'),
  confirmationMessage: z
    .string()
    .describe('Human-readable description of what will be deleted, shown in the confirm UI'),
});

const DeleteResourceResultSchema = z.object({
  confirmed: z.boolean(),
  resourceId: z.string().optional(),
  deletedAt: z.string().optional().describe('ISO timestamp of successful deletion'),
  error: z.string().optional(),
});

export const deleteResourceUserAction: UserActionContribution = {
  name: 'azure:delete-resource',
  wireName: 'azure__delete_resource',
  description:
    'Deletes a specific Azure resource via ARM DELETE after explicit user confirmation. ' +
    'Always warn the user about data loss before dispatching this action.',
  parameters: DeleteResourceParametersSchema,
  resultSchema: DeleteResourceResultSchema,
  confirmComponent: {
    component: 'azure/AzureAction',
    props: { destructive: true },
  },
  scopes: ['https://management.azure.com/.default'],
  cancellation: 'supported',
};
