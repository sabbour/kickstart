import { z } from 'zod';
import type { UserActionContribution } from '@kickstart/harness';

const PickOrgParametersSchema = z.object({
  reason: z
    .string()
    .optional()
    .describe('Optional explanation for why an org or user account is needed'),
});

const PickOrgResultSchema = z.object({
  owner: z.string(),
  type: z.enum(['User', 'Organization']),
});

export const pickOrgUserAction: UserActionContribution = {
  name: 'github:pick_org',
  wireName: 'github__pick_org',
  description:
    'Prompts the user to select a GitHub organization or personal account as the repository owner. ' +
    'Uses the github/OrgPicker component.',
  parameters: PickOrgParametersSchema,
  resultSchema: PickOrgResultSchema,
  confirmComponent: {
    component: 'github/OrgPicker',
    props: {},
  },
  cancellation: 'supported',
};
