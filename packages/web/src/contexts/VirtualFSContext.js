/**
 * @module @kickstart/web/contexts/VirtualFSContext
 *
 * React context for the IndexedDB-backed VirtualFS.
 *
 * Usage:
 *   <VirtualFSProvider>
 *     <App />
 *   </VirtualFSProvider>
 *
 *   const { fs, files, refresh } = useVirtualFS();
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, } from 'react';
import { VirtualFS } from '../services/virtual-fs';
const VirtualFSContext = createContext(null);
export function VirtualFSProvider({ children, store: externalStore }) {
    const fs = useMemo(() => externalStore ?? new VirtualFS(), [externalStore]);
    const [files, setFiles] = useState([]);
    const mountedRef = useRef(true);
    const refresh = useCallback(() => {
        fs.listFiles().then((list) => {
            if (mountedRef.current)
                setFiles(list);
        });
    }, [fs]);
    useEffect(() => {
        mountedRef.current = true;
        refresh();
        const unsub = fs.subscribe(refresh);
        return () => {
            mountedRef.current = false;
            unsub();
        };
    }, [fs, refresh]);
    return (<VirtualFSContext.Provider value={{ fs, files, refresh }}>
      {children}
    </VirtualFSContext.Provider>);
}
/** Hook to access the VirtualFS from any component inside VirtualFSProvider. */
export function useVirtualFS() {
    const ctx = useContext(VirtualFSContext);
    if (!ctx) {
        throw new Error('useVirtualFS must be used inside <VirtualFSProvider>');
    }
    return ctx;
}
//# sourceMappingURL=VirtualFSContext.js.map