import { useRef, useState, useCallback } from 'react';
import { MessageProcessor, Catalog } from '../vendor/a2ui/web_core/index';
import { kickstartCatalog } from '../catalog/kickstart-catalog';
export function useA2UI(options = {}) {
    const processorRef = useRef(null);
    const [surfaces, setSurfaces] = useState(new Map());
    // Keep a stable ref to the handler so the MessageProcessor (created once)
    // always calls the latest version without needing to be recreated.
    const handlerRef = useRef(options.actionHandler);
    handlerRef.current = options.actionHandler;
    if (!processorRef.current) {
        const proc = new MessageProcessor([kickstartCatalog], (action) => {
            if (handlerRef.current) {
                handlerRef.current(action);
            }
            else {
                // eslint-disable-next-line no-console
                console.log('[A2UI] action (no handler):', action);
            }
        });
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
    const processMessages = useCallback((msgs) => {
        const surfaceIds = [];
        for (const msg of msgs) {
            if (msg.createSurface) {
                surfaceIds.push(msg.createSurface.surfaceId);
            }
        }
        processor.processMessages(msgs);
        return surfaceIds;
    }, [processor]);
    const getSurface = useCallback((id) => {
        return processor.model.getSurface(id);
    }, [processor]);
    const reset = useCallback(() => {
        for (const [id] of processor.model.surfacesMap) {
            try {
                processor.model.deleteSurface(id);
            }
            catch { /* ignore */ }
        }
        setSurfaces(new Map());
    }, [processor]);
    return { processor, surfaces, processMessages, getSurface, reset };
}
//# sourceMappingURL=useA2UI.js.map