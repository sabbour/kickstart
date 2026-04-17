import { z } from 'zod';

export interface ComponentApi<Schema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  readonly schema: Schema;
}

export type InferredComponentApiSchemaType<T extends ComponentApi> = z.infer<T['schema']>;
export type ResolveA2uiProps<T> = T;
