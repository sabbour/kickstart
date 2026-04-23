import type { z } from 'zod';

export interface ComponentContribution {
  name: string;
  propertySchema: z.ZodTypeAny;
  renderer: unknown;
  /**
   * Short LLM-facing hint describing the component's purpose, key props, and
   * action slots. Injected into the system prompt so the model knows HOW to
   * use each component — not just its name.
   *
   * #1130 Phase A
   */
  llmHint?: string;
}
