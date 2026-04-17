import { z } from 'zod';
import type { UserActionContribution } from '@kickstart/harness';

const SetSecretParametersSchema = z.object({
  owner: z.string().describe('Repository owner (org or user login)'),
  repo: z.string().describe('Repository name'),
  secretName: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Secret names must be UPPER_SNAKE_CASE')
    .describe('GitHub Actions secret name (e.g. AZURE_CLIENT_ID)'),
  hint: z
    .string()
    .optional()
    .describe('Optional hint shown in the UI to help the user find the value'),
});

const SetSecretResultSchema = z.object({
  secretName: z.string(),
  set: z.literal(true),
});

export const setSecretUserAction: UserActionContribution = {
  name: 'github:set_secret',
  wireName: 'github__set_secret',
  description:
    'Prompts the user to enter and save a GitHub Actions repository secret. ' +
    'The secret value is sent directly to the resume endpoint — never held in component state. ' +
    'Uses the github/SecretSetter component.',
  parameters: SetSecretParametersSchema,
  resultSchema: SetSecretResultSchema,
  confirmComponent: {
    component: 'github/SecretSetter',
    props: {},
  },
  cancellation: 'supported',
};
