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
 *   const { fs, files, fileRecords, tree, refresh } = useVirtualFS();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { VirtualFS, buildFileTree, type VFSFile, type FileTreeNode } from '../services/virtual-fs';

interface VirtualFSContextValue {
  /** The IndexedDB-backed VirtualFS instance. */
  fs: VirtualFS;
  /** Current snapshot of all stored file paths. Updates after every write/delete. */
  files: string[];
  /** Current snapshot of all stored file records with metadata. */
  fileRecords: VFSFile[];
  /** Hierarchical tree built from fileRecords. */
  tree: FileTreeNode[];
  /** Manually trigger a refresh of the file list. */
  refresh: () => void;
}

const VirtualFSContext = createContext<VirtualFSContextValue | null>(null);

interface VirtualFSProviderProps {
  children: ReactNode;
  /** Optional: inject a custom VirtualFS instance (useful in tests). */
  store?: VirtualFS;
}

export function VirtualFSProvider({ children, store: externalStore }: VirtualFSProviderProps) {
  const fs = useMemo(() => externalStore ?? new VirtualFS(), [externalStore]);
  const [fileRecords, setFileRecords] = useState<VFSFile[]>([]);
  const mountedRef = useRef(true);

  const refresh = useCallback(() => {
    fs.readAll()
      .then((records) => {
        if (mountedRef.current) setFileRecords(records);
      })
      .catch((err) => {
        console.error('[VirtualFS] readAll failed:', err);
        if (mountedRef.current) setFileRecords([]);
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

  const files = useMemo(() => fileRecords.map((r) => r.path), [fileRecords]);
  const tree = useMemo(() => buildFileTree(fileRecords), [fileRecords]);

  return (
    <VirtualFSContext.Provider value={{ fs, files, fileRecords, tree, refresh }}>
      {children}
    </VirtualFSContext.Provider>
  );
}

/** Hook to access the VirtualFS from any component inside VirtualFSProvider. */
export function useVirtualFS(): VirtualFSContextValue {
  const ctx = useContext(VirtualFSContext);
  if (!ctx) {
    throw new Error('useVirtualFS must be used inside <VirtualFSProvider>');
  }
  return ctx;
}
