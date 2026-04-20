import { z } from 'zod';
/**
 * azure:update-resource user action.
 *
 * Triggers a partial update (PATCH) of a specific Azure resource via ARM after
 * explicit user confirmation. The browser posts the confirmed payload to
 * /api/converse/resume. The runner performs the actual ARM PATCH.
 *
 * The component NEVER calls ARM directly from the browser.
 */
const UpdateResourceParametersSchema = z.object({
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
        .describe('Display name of the resource being updated'),
    patch: z
        .record(z.string(), z.unknown())
        .describe('Partial ARM resource body for the PATCH request — only changed fields'),
    confirmationMessage: z
        .string()
        .describe('Human-readable description of what this update will change, shown in the confirm UI'),
});
const UpdateResourceResultSchema = z.object({
    confirmed: z.boolean(),
    resourceId: z.string().optional(),
    provisioningState: z.string().optional(),
    updatedFields: z.array(z.string()).optional().describe('Top-level keys that were patched'),
    error: z.string().optional(),
});
export const updateResourceUserAction = {
    name: 'azure:update-resource',
    wireName: 'azure__update_resource',
    description: 'Partially updates a specific Azure resource via ARM PATCH after explicit user confirmation. ' +
        'Use for targeted property changes (e.g. scaling, tag updates, config changes). ' +
        'For full resource replacement use azure:deploy-resource.',
    parameters: UpdateResourceParametersSchema,
    resultSchema: UpdateResourceResultSchema,
    confirmComponent: {
        component: 'azure/AzureAction',
        props: {},
    },
    scopes: ['https://management.azure.com/.default'],
    cancellation: 'supported',
};
//# sourceMappingURL=update-resource.js.map