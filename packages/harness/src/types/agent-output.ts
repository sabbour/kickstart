import { z } from 'zod';

export const AgentOutput = z.object({
  message: z.string(),
  intent: z.enum(['continue', 'advance', 'revise', 'auto-continue-files']).optional(),
}).strict();

export type AgentOutputType = z.infer<typeof AgentOutput>;
