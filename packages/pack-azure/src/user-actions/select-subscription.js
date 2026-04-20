import { z } from 'zod';
/**
 * select-subscription user action.
 *
 * Triggers an MSAL authentication popup to sign the user in to Azure and
 * select an active subscription. The browser performs the MSAL flow and
 * posts the result (token + selected subscription) to /api/converse/resume.
 */
const SelectSubscriptionParametersSchema = z.object({
    reason: z
        .string()
        .optional()
        .describe('Optional explanation for why authentication is needed, shown in the auth UI'),
    preferredSubscriptionId: z
        .string()
        .optional()
        .describe('Optional subscription ID to pre-select if the user has multiple subscriptions'),
});
const SubscriptionInfoSchema = z.object({
    subscriptionId: z.string().uuid(),
    displayName: z.string(),
    tenantId: z.string().uuid(),
    state: z.string().optional(),
});
const SelectSubscriptionResultSchema = z.object({
    authenticated: z.boolean(),
    subscription: SubscriptionInfoSchema.optional(),
    error: z.string().optional(),
});
export const selectSubscriptionUserAction = {
    name: 'azure:select_subscription',
    wireName: 'azure__select_subscription',
    description: 'Authenticates the user with Azure via MSAL and prompts them to select an active subscription. ' +
        'Required before any ARM read or write operations. ' +
        'Uses the azure/SubscriptionSelector component for the selection UI.',
    parameters: SelectSubscriptionParametersSchema,
    resultSchema: SelectSubscriptionResultSchema,
    confirmComponent: {
        component: 'azure/SubscriptionSelector',
        props: {},
    },
    scopes: ['https://management.azure.com/.default'],
    cancellation: 'supported',
};
//# sourceMappingURL=select-subscription.js.map