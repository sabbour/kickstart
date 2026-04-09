import { useRef, useState, useCallback, useEffect } from 'react';
import { MessageProcessor, Catalog } from '../vendor/a2ui/web_core/index';
import { basicCatalog } from '../vendor/a2ui/react/index';
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';
import type { SurfaceModel } from '../vendor/a2ui/web_core/index';
import type { A2uiMsg } from '../types';

export interface A2UIHandle {
  processor: MessageProcessor<ReactComponentImplementation>;
  surfaces: Map<string, SurfaceModel<ReactComponentImplementation>>;
  processMessages: (msgs: A2uiMsg[]) => string[];
  getSurface: (id: string) => SurfaceModel<ReactComponentImplementation> | undefined;
  reset: () => void;
}

export function useA2UI(): A2UIHandle {
  const processorRef = useRef<MessageProcessor<ReactComponentImplementation> | null>(null);
  const [surfaces, setSurfaces] = useState<Map<string, SurfaceModel<ReactComponentImplementation>>>(new Map());

  if (!processorRef.current) {
    processorRef.current = new MessageProcessor<ReactComponentImplementation>(
      [basicCatalog as Catalog<ReactComponentImplementation>],
      (action) => {
        console.log('[A2UI] action:', action);
      }
    );
  }

  const processor = processorRef.current;

  useEffect(() => {
    const sub = processor.onSurfaceCreated((surface) => {
      setSurfaces(prev => {
        const next = new Map(prev);
        next.set(surface.id, surface);
        return next;
      });
    });

    const delSub = processor.onSurfaceDeleted((id) => {
      setSurfaces(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    });

    return () => {
      sub.unsubscribe();
      delSub.unsubscribe();
    };
  }, [processor]);

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
    // Delete all existing surfaces
    for (const [id] of surfaces) {
      try { processor.model.deleteSurface(id); } catch { /* ignore */ }
    }
    setSurfaces(new Map());
  }, [processor, surfaces]);

  return { processor, surfaces, processMessages, getSurface, reset };
}
