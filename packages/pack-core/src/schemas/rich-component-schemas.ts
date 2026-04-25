/**
 * Server-safe Zod schemas for rich components (no JSX imports).
 *
 * These mirror the prop interfaces in packages/web/src/catalog/components/*.tsx
 * so the emit_ui tool can validate LLM output against real component shapes.
 *
 * #1130 Phase A — DecisionCard, RadioGroup, Questionnaire
 */

import { z } from 'zod';

// Dynamic string: literal string or data-binding reference.
// Subset of the full DynamicStringSchema used by the client catalog.
const DynStr = z.union([
  z.string(),
  z.object({ path: z.string() }),
]);

// Action schema matching the emit_ui action envelope.
// Re-declared here (subset) so this file stays self-contained and server-safe.
const ActionSchema = z.object({
  event: z.object({
    name: z.string(),
    payload: z
      .object({
        confirmed: z.boolean().nullable(),
        id: z.string().nullable(),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]).nullable(),
        action: z.string().nullable(),
        target: z.string().nullable(),
      })
      .nullable(),
  }),
});

// ── DecisionCard ────────────────────────────────────────────────────────────
export const DecisionCardSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('DecisionCard'),
  title: DynStr.describe('Decision title — what is being decided.'),
  recommendation: DynStr.describe('The recommended option or course of action.'),
  rationale: DynStr.nullable().describe('Explanation for why this is recommended, or null.'),
  alternatives: z.array(DynStr).nullable().describe('Alternative options considered, or null.'),
  badge: z
    .enum(['recommended', 'best-practice', 'required', 'optional'])
    .nullable()
    .describe('Visual badge shown on the card, or null.'),
}).strict();

// ── RadioGroup ──────────────────────────────────────────────────────────────
export const RadioGroupSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('RadioGroup'),
  options: z.array(
    z.object({
      id: z.string().describe('Unique option identifier.'),
      label: DynStr.describe('Display label for this option.'),
      description: DynStr.nullable().describe('Sub-text shown below the label, or null.'),
      recommended: z.boolean().nullable().describe('Whether to show a Recommended badge, or null.'),
    }),
  ).min(1).describe('Array of radio options — at least one required.'),
  value: DynStr.nullable().describe('Pre-selected option ID, or null for no default.'),
  action: ActionSchema.describe('Action dispatched when the user selects an option.'),
}).strict();

// ── Questionnaire ───────────────────────────────────────────────────────────
export const QuestionnaireSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('Questionnaire'),
  questions: z.array(
    z.object({
      id: z.string().describe('Unique question identifier.'),
      label: DynStr.describe('Question text displayed to the user.'),
      type: z
        .enum(['text', 'choice', 'multiChoice'])
        .nullable()
        .describe('Input type — defaults to text if null.'),
      choices: z.array(
        z.object({
          id: z.string().describe('Choice identifier.'),
          label: DynStr.describe('Choice label text.'),
        }),
      ).nullable().describe('Available choices for choice/multiChoice types, or null.'),
      required: z.boolean().nullable().describe('Whether the question must be answered, or null.'),
    }),
  ).min(1).describe('Array of questions — at least one required.'),
  submitLabel: DynStr.nullable().describe('Custom submit button label, or null for default.'),
  onSubmit: ActionSchema.nullable().describe('Action dispatched when the user submits, or null.'),
}).strict();

/** All rich component schemas keyed by component name. */
export const RICH_COMPONENT_SCHEMAS = new Map<string, z.ZodTypeAny>([
  ['DecisionCard', DecisionCardSchema],
  ['RadioGroup', RadioGroupSchema],
  ['Questionnaire', QuestionnaireSchema],
]);

/** LLM hints for each rich component — one-liner use-case + key props. */
export const RICH_COMPONENT_HINTS = new Map<string, string>([
  [
    'DecisionCard',
    'Display an architectural decision with a recommended option, rationale, and alternatives. ' +
      'Props: title (required), recommendation (required), rationale, alternatives (string[]), ' +
      'badge ("recommended"|"best-practice"|"required"|"optional"). Read-only — no action slot.',
  ],
  [
    'RadioGroup',
    'Single-select option picker with an action event on selection. ' +
      'Props: options (array of {id, label, description?, recommended?}), value (pre-selected id), ' +
      'action (required — fires on pick with event.context.value = selected id).',
  ],
  [
    'Questionnaire',
    'Multi-question form with text, choice, and multiChoice inputs. Submit fires onSubmit action. ' +
      'Props: questions (array of {id, label, type?, choices?, required?}), submitLabel, onSubmit.',
  ],
]);
