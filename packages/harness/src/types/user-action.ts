import type { z } from 'zod';

export interface UserActionContribution {
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
  resultSchema: z.ZodTypeAny;
  confirmComponent?: {
    component: string;
    props?: Record<string, unknown>;
  };
  scopes?: string[];
  cancellation?: 'supported' | 'not-supported';
  mcpExposed?: boolean;
}
