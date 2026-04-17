import type { z } from 'zod';

export interface ComponentContribution {
  name: string;
  propertySchema: z.ZodTypeAny;
  renderer: unknown;
}
