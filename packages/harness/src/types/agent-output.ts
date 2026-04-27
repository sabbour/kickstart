import { z } from 'zod';
import { strictOptional } from '../runtime/z-strict.js';

// I2 strict-mode fix: all properties must appear in `required[]`.
// Replace .optional() with strictOptional() (nullable) so the model sets
// absent fields to null rather than omitting them. Call stripNulls() on
// the parsed output when you need undefined-semantics downstream.
export const AgentOutput = z.object({
  message: strictOptional(z.string()),
  intent: strictOptional(z.enum(['continue', 'advance', 'revise', 'auto-continue-files'])),
}).strict();

export type AgentOutputType = z.infer<typeof AgentOutput>;
