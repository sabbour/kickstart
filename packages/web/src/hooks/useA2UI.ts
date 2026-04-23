import { useRef, useState, useCallback, useEffect } from 'react';
import { MessageProcessor } from '../vendor/a2ui/web_core/index';
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';
import type { SurfaceModel } from '../vendor/a2ui/web_core/index';
import type { A2uiClientAction } from '../vendor/a2ui/web_core/schema/client-to-server';
import type { A2uiMsg } from '../types';
import type { ActionHandler } from './useActionDispatch';
import {
  clientRegistry,
  KICKSTART_CATALOG_ID,
  validateAndSanitizeComponents,
} from '../contexts/A2UIRegistryContext';

// Registry-driven catalog — built from the sealed clientRegistry.
// clientRegistry.seal() must have been called in main.tsx before React mounts.
// Calling buildCatalog() here (module-level) is safe: this module is only
// evaluated after React starts mounting, which is after seal().
function getKickstartCatalog() {
  return clientRegistry.isSealed ? clientRegistry.buildCatalog() : null;
}

export interface A2UIOptions {
  /** Handler invoked when any A2UI component fires an action event. */
  actionHandler?: ActionHandler;
}

export interface A2UIHandle {
  processor: MessageProcessor<ReactComponentImplementation>;
  surfaces: Map<string, SurfaceModel<ReactComponentImplementation>>;
  processMessages: (msgs: A2uiMsg[]) => string[];
  getSurface: (id: string) => SurfaceModel<ReactComponentImplementation> | undefined;
  reset: () => void;
}

/**
 * Filter an incoming A2UI message batch before handing it to the processor.
 *
 * Layer 3 of #1062 (#1060): if a `createSurface` targets a surface that is
 * already present on the canvas, drop that create message (no-op) — any
 * subsequent `updateComponents` for the same surface still lands normally so
 * the agent can update an existing surface without a duplicate-header remount.
 *
 * Pure and exported so it can be exercised without a React rendering context.
 *
 * @returns Filtered batch + the list of surfaceIds referenced by createSurface
 *          messages (including those that were dropped as duplicates). Callers
 *          use the returned IDs to list the rendered surfaces without
 *          special-casing "already existed".
 */
export function _filterMessagesForProcessor(
  msgs: A2uiMsg[],
  hasSurface: (id: string) => boolean,
  validateComponents: (raw: Array<Record<string, unknown>>) => unknown,
  catalogId: string,
): { safeMessages: A2uiMsg[]; surfaceIds: string[] } {
  const seen = new Set<string>();
  const surfaceIds: string[] = [];
  const safeMessages: A2uiMsg[] = [];
  for (const msg of msgs) {
    if (msg.updateComponents) {
      const rawComponents = msg.updateComponents.components as Array<Record<string, unknown>>;
      const validated = validateComponents(rawComponents);
      safeMessages.push({
        ...msg,
        updateComponents: { ...msg.updateComponents, components: validated as any },
      });
      continue;
    }
    if (msg.createSurface) {
      const targetId = msg.createSurface.surfaceId;
      if (hasSurface(targetId)) {
        // eslint-disable-next-line no-console
        console.debug(
          `[useA2UI] createSurface dropped: surface "${targetId}" already exists (treating as update / no-op).`,
        );
        if (!seen.has(targetId)) { seen.add(targetId); surfaceIds.push(targetId); }
        continue;
      }
      if (!seen.has(targetId)) { seen.add(targetId); surfaceIds.push(targetId); }
      safeMessages.push({
        ...msg,
        createSurface: { ...msg.createSurface, catalogId },
      });
      continue;
    }
    safeMessages.push(msg);
  }
  return { safeMessages, surfaceIds };
}

export function useA2UI(options: A2UIOptions = {}): A2UIHandle {
  const processorRef = useRef<MessageProcessor<ReactComponentImplementation> | null>(null);
  const [surfaces, setSurfaces] = useState<Map<string, SurfaceModel<ReactComponentImplementation>>>(new Map());

  // Keep a stable ref to the handler so the MessageProcessor (created once)
  // always calls the latest version without needing to be recreated.
  const handlerRef = useRef<ActionHandler | undefined>(options.actionHandler);
  handlerRef.current = options.actionHandler;

  if (!processorRef.current) {
    const catalog = getKickstartCatalog();
    const catalogs = catalog ? [catalog] : [];
    processorRef.current = new MessageProcessor<ReactComponentImplementation>(
      catalogs,
      (action: A2uiClientAction) => {
        if (handlerRef.current) {
          handlerRef.current(action);
        } else {
          // eslint-disable-next-line no-console
          console.log('[A2UI] action (no handler):', action);
        }
      }
    );
  }

  // Subscribe to surface lifecycle events inside useEffect so that
  // React 19 StrictMode double-mount (mount → cleanup → remount) properly
  // re-establishes listeners. The previous approach stored subscriptions in
  // a ref during render and cleaned them up in a separate useEffect; the
  // cleanup fired during StrictMode remount but the ref-init never re-ran,
  // leaving listeners permanently unsubscribed. That caused
  // A2UIEnvelopePreview surfaces to never reach React state, showing
  // "Missing component: root" on every Playground card in dev mode.
  //
  // Effect-cleanup ordering note: useA2UI's cleanup fires BEFORE the
  // consumer's cleanup (e.g. A2UIEnvelopePreview's deleteSurface), so a
  // deleted surface may briefly remain in React state. This is harmless —
  // the remount effect re-subscribes and the consumer's remount effect
  // re-creates the surface, overwriting the stale entry. React batches
  // all state updates from the mount/cleanup/remount cycle into a single
  // render, so the disposed surface is never visible.
  useEffect(() => {
    const proc = processorRef.current!;
    const sub1 = proc.onSurfaceCreated((surface) => {
      setSurfaces(prev => {
        const next = new Map(prev);
        next.set(surface.id, surface);
        return next;
      });
    });
    const sub2 = proc.onSurfaceDeleted((id) => {
      setSurfaces(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    });
    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
    };
  }, []);

  const processor = processorRef.current;

  const processMessages = useCallback((msgs: A2uiMsg[]): string[] => {
    // Pre-render validation (Zapp Crit1 / Phase B):
    // Validate and sanitize component props before they reach the A2UI processor.
    const { safeMessages, surfaceIds } = _filterMessagesForProcessor(
      msgs,
      (id) => Boolean(processor.model.getSurface(id)),
      (rawComponents) =>
        // Clean-break validation (no back-compat shim): any component whose
        // raw envelope violates the v0.9 spec (e.g. legacy `label` / `onClick`
        // / `items` / `placeholder` / `value` / `disabled` / `onChange` keys
        // the catalog schema no longer accepts) is rejected here and replaced
        // with `_ErrorComponent` by `validateAndSanitizeComponents`. See #984.
        clientRegistry.isSealed
          ? validateAndSanitizeComponents(rawComponents, clientRegistry)
          : rawComponents,
      KICKSTART_CATALOG_ID,
    );

    processor.processMessages(safeMessages as any);
    return surfaceIds;
  }, [processor]);

  const getSurface = useCallback((id: string) => {
    return processor.model.getSurface(id) as SurfaceModel<ReactComponentImplementation> | undefined;
  }, [processor]);

  const reset = useCallback(() => {
    for (const [id] of processor.model.surfacesMap) {
      try { processor.model.deleteSurface(id); } catch { /* ignore */ }
    }
    setSurfaces(new Map());
  }, [processor]);

  return { processor, surfaces, processMessages, getSurface, reset };
}
