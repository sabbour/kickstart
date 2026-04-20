import { z } from 'zod';
import type { UserActionContribution } from '@aks-kickstart/harness';

const PickRepoParametersSchema = z.object({
  owner: z
    .string()
    .describe('GitHub organization or user login to list repositories for'),
  reason: z
    .string()
    .optional()
    .describe('Optional explanation for why a repository is needed'),
});

const PickRepoResultSchema = z.object({
  owner: z.string(),
  name: z.string(),
  defaultBranch: z.string(),
  htmlUrl: z.string(),
});

export const pickRepoUserAction: UserActionContribution = {
  name: 'github:pick_repo',
  wireName: 'github__pick_repo',
  description:
    'Prompts the user to select an existing GitHub repository. ' +
    'Uses the github/RepoPicker component in pick mode.',
  parameters: PickRepoParametersSchema,
  resultSchema: PickRepoResultSchema,
  confirmComponent: {
    component: 'github/RepoPicker',
    props: { mode: 'pick' },
  },
  cancellation: 'supported',
};
