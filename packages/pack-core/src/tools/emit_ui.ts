import { tool } from '@openai/agents';
import { z } from 'zod';
import { A2UIMessageSchema } from '@aks-kickstart/harness';
import type { A2UIMessageV09 } from '@aks-kickstart/harness';
import type { ToolContribution, SessionCtx } from '@aks-kickstart/harness';

// ── Schema ────────────────────────────────────────────────────────────────────

// Scalar values that can appear in data-model and component property fields.
const A2UIScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

// Lightweight component schema — v0.9 adjacency-list shape.
// See https://a2ui.org/specification/v0.9-a2ui/ and
// https://a2ui.org/concepts/components/.
//
// The runtime re-validates against the full harness A2UIMessageSchema in
// execute(), so this schema only needs to be strict enough for the OpenAI API
// to accept it without a 400 AND to keep the LLM on-spec.
//
// IMPORTANT:
// - Use `component` (not `type`) and `id` for every entry.
// - Container hierarchy is expressed via `child` (single ID) or
//   `children` (array of IDs) — NEVER `items`.
// - A Button's label is a CHILD Text component referenced via `child`.
//   There is no top-level `label`.
// - Interactions go through `action: { event: { name, payload? } }`.
//   There is no `onClick` / `onChange` string shorthand.
const A2UIComponentSchema = z.object({
  id: z.string().describe('Unique component ID within this surface, e.g. "root".'),
  component: z
    .string()
    .describe('Bare component name, e.g. "Button", "Row", "Text" — no pack prefix.'),
  // --- Hierarchy (v0.9 adjacency list) ---
  child: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Single child component ID. Use on single-slot containers like Card or ' +
        'a Button (the Button\'s visible label is a Text child referenced here). ' +
        'Must reference another component emitted in the same updateComponents call.',
    ),
  children: z
    .array(z.string())
    .nullable()
    .optional()
    .describe(
      'Ordered array of child component IDs. Use on multi-slot containers like ' +
        'Row, Column, and List. Each ID must reference another component in the same call.',
    ),
  // --- Leaf content ---
  text: z
    .string()
    .nullable()
    .optional()
    .describe('Literal text content for a Text component.'),
  // --- Interactions ---
  action: z
    .object({
      event: z.object({
        name: z.string().describe('Event name dispatched when the component is activated.'),
        payload: z
          .record(z.string(), A2UIScalar)
          .optional()
          .describe('Optional flat payload (string/number/boolean/null values) delivered with the event.'),
      }),
    })
    .optional()
    .describe(
      'Interaction descriptor for clickable / editable components. ' +
        'Use `action: { event: { name: "..." } }` — never a bare onClick string.',
    ),
});

// Full discriminated union for the A2UI v0.9 envelope.
//
// z.unknown() was previously used here, but the OpenAI Responses API rejects
// tool schemas where any property in `properties` is missing a `type` key
// (HTTP 400: "schema must have a 'type' key"). z.discriminatedUnion produces
// a `oneOf` with all branches carrying `type: "object"`, which satisfies the
// validator. The `op` discriminator is required by the schema; the runtime
// A2UIMessageSchema.parse() in execute() still accepts envelopes with or
// without `op` via the `withDiscriminator` preprocessor.
const A2UIMessageInputSchema = z.discriminatedUnion('op', [
  z.object({
    version: z.literal('v0.9'),
    op: z.literal('createSurface'),
    createSurface: z.object({
      surfaceId: z.string(),
      catalogId: z.string().describe('Must always be "kickstart"'),
      sendDataModel: z.boolean().nullable().optional(),
    }),
  }),
  z.object({
    version: z.literal('v0.9'),
    op: z.literal('updateComponents'),
    updateComponents: z.object({
      surfaceId: z.string(),
      components: z.array(A2UIComponentSchema).min(1),
    }),
  }),
  z.object({
    version: z.literal('v0.9'),
    op: z.literal('updateDataModel'),
    updateDataModel: z.object({
      surfaceId: z.string(),
      path: z.string().nullable().optional(),
      value: A2UIScalar.nullable().optional(),
    }),
  }),
  z.object({
    version: z.literal('v0.9'),
    op: z.literal('deleteSurface'),
    deleteSurface: z.object({
      surfaceId: z.string(),
    }),
  }),
]).describe(
  'A valid A2UI v0.9 message envelope. Must have "version": "v0.9" and "op" set to one of: ' +
  '"createSurface", "updateComponents", "updateDataModel", "deleteSurface". ' +
  'Include the matching payload object (e.g. "createSurface": { "surfaceId": "...", "catalogId": "..." }).',
);

const EmitUiInputSchema = z.object({
  message: A2UIMessageInputSchema,
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const emitUiTool: ToolContribution = {
  name: 'core.emit_ui',
  tool: tool({
    name: 'core.emit_ui',
    description:
      'Validates and emits an A2UI v0.9 message (spec: https://a2ui.org/specification/v0.9-a2ui/). ' +
      'The message is validated against the A2UI schema and recorded on the session context ' +
      'so the runner can stream it to the browser as an "a2ui" SSE event. ' +
      'IMPORTANT rules (v0.9):\n' +
      '- In createSurface messages, always set catalogId to "kickstart".\n' +
      '- In updateComponents, emit a FLAT adjacency list of components. Every entry has ' +
      '`id` (unique within surface) and `component` (bare name, e.g. "Button", "Row", "Text").\n' +
      '- Hierarchy is EXPLICIT: containers declare `child` (single ID) or `children` (array of IDs). ' +
      'Components are never nested by emit order.\n' +
      '- A Button\'s visible label is a Text CHILD referenced via `child` — there is NO top-level `label` prop.\n' +
      '- Interactions use `action: { event: { name, payload? } }`. Do NOT emit `onClick` / `onChange` / `items` / ' +
      '`placeholder` / `value` / `disabled` as top-level fields — they are not part of v0.9 and will be ignored.\n' +
      'Spec-compliant example:\n' +
      '{"version":"v0.9","updateComponents":{"surfaceId":"main","components":[' +
      '{"id":"root","component":"Column","children":["greeting","buttons"]},' +
      '{"id":"greeting","component":"Text","text":"Hello"},' +
      '{"id":"buttons","component":"Row","children":["cancel-btn","ok-btn"]},' +
      '{"id":"cancel-btn","component":"Button","child":"cancel-text","action":{"event":{"name":"cancel"}}},' +
      '{"id":"cancel-text","component":"Text","text":"Cancel"},' +
      '{"id":"ok-btn","component":"Button","child":"ok-text","action":{"event":{"name":"ok"}}},' +
      '{"id":"ok-text","component":"Text","text":"OK"}]}}',
    parameters: EmitUiInputSchema,
    execute: async (input, runCtx): Promise<string> => {
      const session = runCtx?.context as SessionCtx | undefined;

      // Re-validate through the full harness A2UIMessageSchema which applies
      // the withDiscriminator preprocessor and strips the 'op' discriminator
      // field. This is the canonical runtime validation path.
      let parsed: A2UIMessageV09;
      try {
        parsed = A2UIMessageSchema.parse(input.message) as A2UIMessageV09;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`emit_ui: invalid A2UI message — ${msg}`, { cause: err });
      }

      if (session) {
        session.recordA2UIEmission(parsed);
      }

      // Derive op name from the key that isn't 'version' (A2UIMessageSchema strips the 'op' field).
      const op = Object.keys(parsed as Record<string, unknown>)
        .find(k => k !== 'version') ?? 'unknown';
      return `emitted: ${op}`;
    },
  }),
};
