import { tool } from '@openai/agents';
import { z } from 'zod';
import { A2UIMessageSchema } from '@aks-kickstart/harness';
import type { A2UIMessageV09 } from '@aks-kickstart/harness';
import type { ToolContribution, SessionCtx } from '@aks-kickstart/harness';

// ── Schema ────────────────────────────────────────────────────────────────────

// Scalar values that can appear in data-model and component property fields.
const A2UIScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

// Lightweight component schema — enforces `type` (required by A2UI) and the
// most common optional rendering props. The runtime re-validates against the
// full harness A2UIMessageSchema in execute(), so this schema only needs to be
// strict enough for the OpenAI API to accept it without a 400.
const A2UIComponentSchema = z.object({
  type: z.string().describe('Component type name from the A2UI catalog'),
  label: z.string().nullable().optional(),
  placeholder: z.string().nullable().optional(),
  value: A2UIScalar.nullable().optional(),
  disabled: z.boolean().nullable().optional(),
  items: z.array(z.object({ label: z.string(), value: z.string() })).nullable().optional(),
  onClick: z.string().nullable().optional(),
  onChange: z.string().nullable().optional(),
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
      catalogId: z.string(),
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
      'Validates and emits an A2UI v0.9 message. ' +
      'The message is validated against the A2UI schema and then recorded on the session context ' +
      'so the runner can stream it to the browser as an "a2ui" SSE event. ' +
      'Use this any time you want to create, update, or remove a UI surface.',
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
