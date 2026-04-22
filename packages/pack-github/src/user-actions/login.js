import { z } from 'zod';
const LoginParametersSchema = z.object({
    reason: z
        .string()
        .optional()
        .describe('Optional explanation for why GitHub authentication is needed'),
});
const GitHubViewerSummarySchema = z.object({
    login: z.string(),
    name: z.string().nullable().optional(),
    avatarUrl: z.string().optional(),
});
const LoginResultSchema = z.object({
    authenticated: z.literal(true),
    viewer: GitHubViewerSummarySchema,
});
export const loginUserAction = {
    name: 'github:login',
    wireName: 'github__login',
    description: 'Authenticates the user with GitHub via OAuth popup. ' +
        'Required before any GitHub API operations. ' +
        'Uses the github/Login component for the sign-in UI.',
    parameters: LoginParametersSchema,
    resultSchema: LoginResultSchema,
    confirmComponent: {
        component: 'github/Login',
        props: {},
    },
    cancellation: 'supported',
};
//# sourceMappingURL=login.js.map