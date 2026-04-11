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
import React, { type ReactNode } from 'react';
import { VirtualFS } from '../services/virtual-fs';
interface VirtualFSContextValue {
    /** The IndexedDB-backed VirtualFS instance. */
    fs: VirtualFS;
    /** Current snapshot of all stored file paths. Updates after every write/delete. */
    files: string[];
    /** Manually trigger a refresh of the file list. */
    refresh: () => void;
}
interface VirtualFSProviderProps {
    children: ReactNode;
    /** Optional: inject a custom VirtualFS instance (useful in tests). */
    store?: VirtualFS;
}
export declare function VirtualFSProvider({ children, store: externalStore }: VirtualFSProviderProps): React.JSX.Element;
/** Hook to access the VirtualFS from any component inside VirtualFSProvider. */
export declare function useVirtualFS(): VirtualFSContextValue;
export {};
//# sourceMappingURL=VirtualFSContext.d.ts.map