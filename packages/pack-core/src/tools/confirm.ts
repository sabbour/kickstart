/**
 * @file confirm.ts
 *
 * `core.confirm` — render a confirmation dialog surface.
 *
 * High-level tool: the agent provides a surface ID, a title, a message, and
 * optional button labels.  This tool internally constructs and emits the A2UI
 * v0.9 updateComponents message so the LLM never needs to spell out the
 * button/text adjacency list for a simple yes/no dialog.
 *
 * The surface MUST already exist (created with `createSurface` via
 * `core.show_card` or `core.show_form`) before calling this tool.
 *
 * When the user responds, the client emits a `confirm` or `cancel` event
 * carrying `{ confirmed: true }` or `{ confirmed: false }` in the payload.
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import { A2UIMessageSchema } from '@aks-kickstart/harness';
import type { A2UIMessageV09 } from '@aks-kickstart/harness';
import type { ToolContribution, SessionCtx } from '@aks-kickstart/harness';
import { SurfaceIdSchema } from './_a2ui-shared.js';

// ── Schema ────────────────────────────────────────────────────────────────────

const ConfirmInputSchema = z.object({
  surfaceId: SurfaceIdSchema.describe(
    'ID of the surface to render the confirmation dialog on. ' +
      'The surface must have been created first via core.show_card or core.show_form.',
  ),
  title: z
    .string()
    .nullable()
    .describe('Dialog heading, e.g. "Delete cluster?". Set to null to omit.'),
  message: z.string().describe('Body text explaining what requires confirmation.'),
  confirmLabel: z
    .string()
    .nullable()
    .describe('Label for the primary confirm button. Defaults to "Confirm" when null.'),
  cancelLabel: z
    .string()
    .nullable()
    .describe('Label for the cancel button. Defaults to "Cancel" when null.'),
});

// ── Tool ───────────────────────────────────────────────────────────────────────

export const confirmTool: ToolContribution = {
  name: 'core.confirm',
  tool: tool({
    name: 'core.confirm',
    description:
      'Renders a confirmation dialog on an existing surface (A2UI v0.9). ' +
      'Provide a surface ID, a message, and optional title and button labels. ' +
      'The tool constructs and emits the full A2UI updateComponents message ' +
      'internally — no component adjacency list needed.\n' +
      'When the user clicks a button the client emits a "confirm" event with ' +
      '`payload: { confirmed: true }` or a "cancel" event with ' +
      '`payload: { confirmed: false }`.\n' +
      'The surface must already exist. Create it first with core.show_card ' +
      'or core.show_form using op:"createSurface".',
    parameters: ConfirmInputSchema,
    execute: async (input, runCtx): Promise<string> => {
      const session = runCtx?.context as SessionCtx | undefined;
      const confirmLabel = input.confirmLabel ?? 'Confirm';
      const cancelLabel = input.cancelLabel ?? 'Cancel';

      // Build a flat A2UI updateComponents envelope for a confirm dialog.
      // Component tree:
      //   root (Column)
      //     ├─ title (Text) — only when input.title is set
      //     ├─ msg (Text)
      //     └─ buttons (Row)
      //          ├─ confirm-btn (Button) → confirm-lbl (Text)
      //          └─ cancel-btn  (Button) → cancel-lbl  (Text)
      const components: Array<Record<string, unknown>> = [];
      const rootChildren: string[] = [];

      if (input.title) {
        components.push({ id: 'confirm-title', component: 'Text', text: input.title });
        rootChildren.push('confirm-title');
      }
      components.push({ id: 'confirm-msg', component: 'Text', text: input.message });
      rootChildren.push('confirm-msg');
      rootChildren.push('confirm-buttons');

      components.push(
        { id: 'confirm-buttons', component: 'Row', children: ['confirm-btn', 'cancel-btn'] },
        {
          id: 'confirm-btn',
          component: 'Button',
          child: 'confirm-lbl',
          action: { event: { name: 'confirm', payload: { confirmed: true } } },
        },
        { id: 'confirm-lbl', component: 'Text', text: confirmLabel },
        {
          id: 'cancel-btn',
          component: 'Button',
          child: 'cancel-lbl',
          action: { event: { name: 'cancel', payload: { confirmed: false } } },
        },
        { id: 'cancel-lbl', component: 'Text', text: cancelLabel },
      );

      components.unshift({ id: 'confirm-root', component: 'Column', children: rootChildren });

      const envelope = {
        version: 'v0.9',
        op: 'updateComponents',
        updateComponents: { surfaceId: input.surfaceId, components },
      };

      if (session) {
        if (!session.liveSurfaceIds.has(input.surfaceId)) {
          throw new Error(
            `core.confirm: surface '${input.surfaceId}' does not exist — ` +
              `create it first via core.show_card or core.show_form`,
          );
        }

        let parsed: A2UIMessageV09;
        try {
          parsed = A2UIMessageSchema.parse(envelope) as A2UIMessageV09;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`core.confirm: invalid A2UI message — ${msg}`, { cause: err });
        }
        session.recordA2UIEmission(parsed);
      }

      return `emitted: updateComponents (confirm dialog on '${input.surfaceId}')`;
    },
  }),
};
