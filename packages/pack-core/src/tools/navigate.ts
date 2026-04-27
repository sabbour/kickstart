/**
 * @file navigate.ts
 *
 * `core.navigate` — emit data-model updates and surface lifecycle events.
 *
 * Handles the two A2UI v0.9 operations that don't render components:
 *   - `updateDataModel` — push a new scalar value to a JSON-pointer path in
 *     the surface's data model (used for data-binding driven re-renders).
 *   - `deleteSurface` — close/remove a surface entirely.
 *
 * For creating or rendering surfaces use `core.show_card` or `core.show_form`.
 * For confirmation dialogs use `core.confirm`.
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution, SessionCtx } from '@aks-kickstart/harness';
import { SurfaceIdSchema, A2UIScalar, executeA2UIMessage } from './_a2ui-shared.js';

// ── Schema ────────────────────────────────────────────────────────────────────

const NavigateInputSchema = z.object({
  message: z.discriminatedUnion('op', [
    z.object({
      version: z.literal('v0.9'),
      op: z.literal('updateDataModel'),
      updateDataModel: z.object({
        surfaceId: SurfaceIdSchema,
        path: z
          .string()
          .nullable()
          .describe(
            'JSON-pointer-like path to the data-model field to update (e.g. "/app/name"), ' +
              'or null to replace the entire root.',
          ),
        value: A2UIScalar.nullable().describe('New scalar value to set at `path`. May be null.'),
      }),
    }),
    z.object({
      version: z.literal('v0.9'),
      op: z.literal('deleteSurface'),
      deleteSurface: z.object({
        surfaceId: SurfaceIdSchema,
      }),
    }),
  ]).describe(
    'A2UI v0.9 envelope for data-model updates or surface deletion. ' +
      'Use "updateDataModel" to push a data-binding value into a live surface. ' +
      'Use "deleteSurface" to close/remove a surface when it is no longer needed.',
  ),
});

// ── Tool ───────────────────────────────────────────────────────────────────────

export const navigateTool: ToolContribution = {
  name: 'core.navigate',
  tool: tool({
    name: 'core.navigate',
    description:
      'Emits A2UI v0.9 data-model update or surface deletion events. ' +
      'Use "updateDataModel" to push a new value into a live surface\'s data model ' +
      '(triggering data-binding re-renders without rebuilding the component tree). ' +
      'Use "deleteSurface" to close a surface when it is no longer needed — ' +
      'always delete surfaces you no longer use to stay within the session surface cap.\n' +
      'The surface must already exist before calling this tool.\n' +
      'To create surfaces use core.show_card or core.show_form with op:"createSurface".\n' +
      'Example (update): {"version":"v0.9","op":"updateDataModel",' +
      '"updateDataModel":{"surfaceId":"main","path":"/status","value":"ready"}}\n' +
      'Example (delete): {"version":"v0.9","op":"deleteSurface",' +
      '"deleteSurface":{"surfaceId":"main"}}',
    parameters: NavigateInputSchema,
    execute: async (input, runCtx): Promise<string> => {
      const session = runCtx?.context as SessionCtx | undefined;
      return executeA2UIMessage(input.message, session, 'core.navigate');
    },
  }),
};
