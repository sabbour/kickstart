import { tool } from '@openai/agents';
import { z } from 'zod';
import { A2UIMessageSchema } from '@aks-kickstart/harness';
import type { A2UIMessageV09 } from '@aks-kickstart/harness';
import type { ToolContribution, SessionCtx } from '@aks-kickstart/harness';

// ── Schema ────────────────────────────────────────────────────────────────────

// The tool accepts any object — we validate it as an A2UI message envelope using
// A2UIMessageSchema from the harness. Using z.unknown() here because the model
// passes a raw JSON value; Zod validates the shape in execute().
const EmitUiInputSchema = z.object({
  message: z
    .unknown()
    .describe(
      'A valid A2UI v0.9 message envelope. Must have a "version" field equal to "v0.9" ' +
      'and one of the following "op" values: "createSurface", "updateComponents", ' +
      '"updateDataModel", "deleteSurface". See the A2UI schema for the full payload shape.',
    ),
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
