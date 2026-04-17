import { useRef, useState, useCallback, useEffect } from 'react';
import { MessageProcessor, Catalog } from '../vendor/a2ui/web_core/index';
// TODO(Step 4): kickstartCatalog replaced by registry-driven catalog from @kickstart/harness
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';
import type { SurfaceModel } from '../vendor/a2ui/web_core/index';
import type { A2uiClientAction } from '../vendor/a2ui/web_core/schema/client-to-server';
import type { A2uiMsg } from '../types';
import type { ActionHandler } from './useActionDispatch';

// Stub catalog — empty until Step 4 wires up the registry-driven catalog
const kickstartCatalog = {} as Catalog<ReactComponentImplementation>;

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
  const subscriptionsRef = useRef<Array<{ unsubscribe(): void }>>([]);
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
          // eslint-disable-next-line no-console
          console.log('[A2UI] action (no handler):', action);
        }
      }
    );

    // Bind surface lifecycle events to React state at creation time instead
    // of in a useEffect. This avoids a React 19 StrictMode ordering bug:
    // useEffect cleanups run in registration order, so useA2UI's cleanup
    // (unsubscribe) fires BEFORE the consumer's cleanup (deleteSurface).
    // That leaves disposed surfaces in React state because onSurfaceDeleted
    // has no listener. By subscribing here, the listener stays active through
    // StrictMode cleanup/remount cycles. Subscriptions are stored so they can
    // be cleaned up on final unmount to prevent memory leaks.
    subscriptionsRef.current.push(
      proc.onSurfaceCreated((surface) => {
        setSurfaces(prev => {
          const next = new Map(prev);
          next.set(surface.id, surface);
          return next;
        });
      })
    );

    subscriptionsRef.current.push(
      proc.onSurfaceDeleted((id) => {
        setSurfaces(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      })
    );

    processorRef.current = proc;
  }

  // Clean up subscriptions on final unmount to prevent memory leaks.
  // In StrictMode dev double-mount, the ref-init block does not re-run so
  // subscriptions persist through the cycle — this is intentional (see above).
  useEffect(() => {
    const subs = subscriptionsRef.current;
    return () => { for (const s of subs) s.unsubscribe(); };
  }, []);

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
