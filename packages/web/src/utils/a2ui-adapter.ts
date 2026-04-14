import type { A2uiMsg } from '../types';

/**
 * Adapts a raw A2UI message from the backend (flat, with `type` discriminator)
 * into the nested shape the frontend A2UI processor expects.
 *
 * Backend sends:  { type: "createSurface", surfaceId: "…", catalogId: "…" }
 * Frontend needs: { version: "v0.9", createSurface: { surfaceId: "…", catalogId: "…" } }
 *
 * Messages already in the nested shape (i.e. they have `version`) pass through unchanged.
 */
export function adaptA2uiMessage(raw: any): A2uiMsg {
  // Already in nested/frontend shape — pass through
  if (raw?.version) {
    return raw as A2uiMsg;
  }

  const msg: A2uiMsg = { version: 'v0.9' as const };

  switch (raw?.type) {
    case 'createSurface':
      msg.createSurface = { surfaceId: raw.surfaceId, catalogId: raw.catalogId };
      break;
    case 'updateComponents':
      msg.updateComponents = { surfaceId: raw.surfaceId, components: raw.components };
      break;
    case 'deleteSurface':
      msg.deleteSurface = { surfaceId: raw.surfaceId };
      break;
    case 'updateDataModel':
      msg.updateDataModel = { surfaceId: raw.surfaceId, path: raw.path, value: raw.value };
      break;
  }

  return msg;
}
