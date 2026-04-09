import { useRef, useState, useCallback } from 'react';
import { MessageProcessor, Catalog } from '../vendor/a2ui/web_core/index';
import { kickstartCatalog } from '../catalog/kickstart-catalog';
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';
import type { SurfaceModel } from '../vendor/a2ui/web_core/index';
import type { A2uiClientAction } from '../vendor/a2ui/web_core/schema/client-to-server';
import type { A2uiMsg } from '../types';
import type { ActionHandler } from './useActionDispatch';

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

export function useA2UI(options: A2UIOptions = {}): A2UIHandle {
  const processorRef = useRef<MessageProcessor<ReactComponentImplementation> | null>(null);
  const [surfaces, setSurfaces] = useState<Map<string, SurfaceModel<ReactComponentImplementation>>>(new Map());

  // Keep a stable ref to the handler so the MessageProcessor (created once)
  // always calls the latest version without needing to be recreated.
  const handlerRef = useRef<ActionHandler | undefined>(options.actionHandler);
  handlerRef.current = options.actionHandler;

  if (!processorRef.current) {
    const proc = new MessageProcessor<ReactComponentImplementation>(
      [kickstartCatalog as Catalog<ReactComponentImplementation>],
      (action: A2uiClientAction) => {
        if (handlerRef.current) {
          handlerRef.current(action);
        } else {
          console.log('[A2UI] action (no handler):', action);
        }
      }
    );

    // Bind surface lifecycle events to React state at creation time instead
    // of in a useEffect. This avoids a React 19 StrictMode ordering bug:
    // useEffect cleanups run in registration order, so useA2UI's cleanup
    // (unsubscribe) fires BEFORE the consumer's cleanup (deleteSurface).
    // That leaves disposed surfaces in React state because onSurfaceDeleted
    // has no listener. By subscribing here and never unsubscribing, the
    // listener stays active through StrictMode cleanup/remount cycles.
    proc.onSurfaceCreated((surface) => {
      setSurfaces(prev => {
        const next = new Map(prev);
        next.set(surface.id, surface);
        return next;
      });
    });

    proc.onSurfaceDeleted((id) => {
      setSurfaces(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    });

    processorRef.current = proc;
  }

  const processor = processorRef.current;

  const processMessages = useCallback((msgs: A2uiMsg[]): string[] => {
    const surfaceIds: string[] = [];
    for (const msg of msgs) {
      if (msg.createSurface) {
        surfaceIds.push(msg.createSurface.surfaceId);
      }
    }
    processor.processMessages(msgs as any);
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
