/**
 * @module _a2ui-shared
 *
 * Internal shared primitives for the focused A2UI tools (show_card, show_form,
 * confirm, navigate).  NOT part of the public package surface — do not export
 * from tools/index.ts.
 *
 * Rationale: the four focused tools all need the same scalar helpers, the
 * SurfaceIdSchema, and the surface-lifecycle guard.  Centralising them here
 * keeps each tool file focused on its own narrow schema and avoids drift.
 */

import { z } from 'zod';
import { A2UIMessageSchema } from '@aks-kickstart/harness';
import type { A2UIMessageV09 } from '@aks-kickstart/harness';
import type { SessionCtx } from '@aks-kickstart/harness';
import { stripNulls } from '@aks-kickstart/harness/runtime/z-strict';

// ── Scalar primitives ─────────────────────────────────────────────────────────

export const A2UIScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const A2UIDynamicString = z.union([
  z.string(),
  z.object({ path: z.string().describe('JSON Pointer path into the data model.') }),
]);

export const A2UIDynamicBoolean = z.union([
  z.boolean(),
  z.object({ path: z.string().describe('JSON Pointer path into the data model.') }),
]);

export const A2UIDynamicNumber = z.union([
  z.number(),
  z.object({ path: z.string().describe('JSON Pointer path into the data model.') }),
]);

// ── Surface ID ────────────────────────────────────────────────────────────────

/** Bounded surface id — D11 / Zapp M1 (#1075). Length-only, no charset regex. */
export const SurfaceIdSchema = z.string().min(1).max(128);

// ── Action schema ─────────────────────────────────────────────────────────────

/**
 * Strict-mode-safe action envelope.  The `payload` key set is closed (#1032):
 * unused keys MUST be set to null and are stripped by stripNulls() before
 * A2UIMessageSchema.parse().
 */
export const A2UIActionSchema = z.object({
  event: z.object({
    name: z.string().describe(
      'Structured event name emitted when the component is activated. ' +
        'Use `action: { event: { name: "..." } }` — never a bare onClick string.',
    ),
    payload: z
      .object({
        confirmed: z.boolean().nullable(),
        id: z.string().nullable(),
        value: A2UIScalar.nullable(),
        action: z.string().nullable(),
        target: z.string().nullable(),
      })
      .nullable()
      .describe(
        'Event payload with a closed key set (confirmed, id, value, action, target). ' +
          'Unused keys MUST be set to null.',
      ),
  }),
});

// ── Surface lifecycle helper ──────────────────────────────────────────────────

type ParsedA2UIRecord = {
  createSurface?: { surfaceId: string };
  updateComponents?: { surfaceId: string };
  updateDataModel?: { surfaceId: string };
  deleteSurface?: { surfaceId: string };
};

/**
 * Validate + emit a raw A2UI message envelope from a focused tool's execute().
 *
 * Applies stripNulls → A2UIMessageSchema.parse → surface lifecycle guards →
 * session.recordA2UIEmission.  Returns the op name string used for the tool
 * return value.
 */
export async function executeA2UIMessage(
  rawMessage: unknown,
  session: SessionCtx | undefined,
  toolName: string,
): Promise<string> {
  let parsed: A2UIMessageV09;
  try {
    const cleaned = stripNulls(rawMessage);
    parsed = A2UIMessageSchema.parse(cleaned) as A2UIMessageV09;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${toolName}: invalid A2UI message — ${msg}`, { cause: err });
  }

  if (session) {
    const rec = parsed as unknown as ParsedA2UIRecord;
    if (rec.createSurface) {
      const surfaceId = rec.createSurface.surfaceId;
      if (session.liveSurfaceIds.has(surfaceId)) {
        throw new Error(
          `${toolName}: surface '${surfaceId}' already exists — use updateComponents to modify it`,
        );
      }
      if (session.liveSurfaceIds.size >= session.maxLiveSurfaces) {
        throw new Error(
          `${toolName}: session surface cap reached (${session.maxLiveSurfaces}) — ` +
            `delete unused surfaces with core.navigate before creating new ones`,
        );
      }
    } else {
      const targeted = rec.updateComponents ?? rec.updateDataModel ?? rec.deleteSurface;
      if (targeted) {
        const surfaceId = targeted.surfaceId;
        if (!session.liveSurfaceIds.has(surfaceId)) {
          throw new Error(
            `${toolName}: surface '${surfaceId}' does not exist — call createSurface first`,
          );
        }
      }
    }
    session.recordA2UIEmission(parsed);
  }

  const op =
    Object.keys(parsed as Record<string, unknown>).find((k) => k !== 'version') ?? 'unknown';
  return `emitted: ${op}`;
}
