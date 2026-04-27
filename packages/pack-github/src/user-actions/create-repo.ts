import { z } from 'zod';
import type { UserActionContribution } from '@aks-kickstart/harness';

const CreateRepoParametersSchema = z.object({
  owner: z
    .string()
    .describe('GitHub organization or user login to create the repository under'),
  suggestedName: z
    .string()
    .nullable()
    .optional()
    .describe('Suggested repository name to pre-fill in the creation form'),
  private: z
    .boolean()
    .nullable()
    .optional()
    .default(true)
    .describe('Whether the repository should be private (default: true)'),
});

const CreateRepoResultSchema = z.object({
  owner: z.string(),
  name: z.string(),
  private: z.boolean(),
  htmlUrl: z.string(),
});

export const createRepoUserAction: UserActionContribution = {
  name: 'github:create_repo',
  wireName: 'github__create_repo',
  description:
    'Prompts the user to create a new GitHub repository. ' +
    'Uses the github/RepoPicker component in create mode.',
  parameters: CreateRepoParametersSchema,
  resultSchema: CreateRepoResultSchema,
  confirmComponent: {
    component: 'github/RepoPicker',
    props: { mode: 'create' },
  },
  cancellation: 'supported',
};
