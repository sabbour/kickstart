import { z } from 'zod';
import type { UserActionContribution } from '@kickstart/harness';

/**
 * arm-write user action.
 *
 * Dispatched by the AzureAction component confirm gate.
 * The browser posts the confirmed ARM write payload to /api/converse/resume.
 * The server-side runner then performs the actual ARM PUT/PATCH/DELETE.
 *
 * The component NEVER calls ARM directly from the browser.
 */

const ArmWriteParametersSchema = z.object({
  path: z
    .string()
    .describe('Full ARM resource path, subscription-scoped'),
  method: z
    .enum(['PUT', 'PATCH', 'DELETE'])
    .describe('HTTP method for the ARM write'),
  apiVersion: z
    .string()
    .describe('ARM API version, e.g. "2023-01-01"'),
  body: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Request body for PUT/PATCH operations'),
  confirmationMessage: z
    .string()
    .describe('Human-readable description of what this write will do, shown in the confirm UI'),
});

const ArmWriteResultSchema = z.object({
  confirmed: z.boolean(),
  resourceId: z.string().optional(),
  provisioningState: z.string().optional(),
  error: z.string().optional(),
});

export const armWriteUserAction: UserActionContribution = {
  name: 'azure:arm_write',
  wireName: 'azure__arm_write',
  description:
    'Performs an ARM write operation (PUT/PATCH/DELETE) after explicit user confirmation. ' +
    'The confirm UI is shown before any ARM call is made. ' +
    'On confirmation, the browser posts the result back via /api/converse/resume.',
  parameters: ArmWriteParametersSchema,
  resultSchema: ArmWriteResultSchema,
  confirmComponent: {
    component: 'azure/AzureAction',
    props: {},
  },
  scopes: ['https://management.azure.com/.default'],
  cancellation: 'supported',
};
