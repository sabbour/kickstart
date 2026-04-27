import { z } from 'zod';
import type { UserActionContribution } from '@aks-kickstart/harness';

const CreatePRParametersSchema = z.object({
  owner: z.string().describe('Repository owner (org or user login)'),
  repo: z.string().describe('Repository name'),
  targetBranch: z.string().describe('Branch to merge into (e.g. main)'),
  files: z
    .array(z.string())
    .describe('List of file paths being committed in this PR'),
  prTitle: z
    .string()
    .max(255)
    .describe('Pull request title (max 255 characters)'),
  prBody: z
    .string()
    .nullable()
    .optional()
    .describe('Pull request description body'),
});

const CreatePRResultSchema = z.object({
  prNumber: z.number().int().positive(),
  prUrl: z.string(),
  branch: z.string(),
});

export const createPRUserAction: UserActionContribution = {
  name: 'github:create_pr',
  wireName: 'github__create_pr',
  description:
    'Pushes generated files to a new branch and opens a pull request. ' +
    'Orchestrates the full push+PR flow via the github-handoff service. ' +
    'Uses the github/CreatePRFlow component.',
  parameters: CreatePRParametersSchema,
  resultSchema: CreatePRResultSchema,
  confirmComponent: {
    component: 'github/CreatePRFlow',
    props: {},
  },
  cancellation: 'supported',
};
