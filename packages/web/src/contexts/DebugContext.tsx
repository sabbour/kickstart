import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { ActionDebugEvent } from '../types';

const STORAGE_KEY = 'kickstart-debug';

interface DebugContextValue {
  /** Whether debug mode is currently active. */
  debugEnabled: boolean;
  /** Toggle debug mode on/off. */
  toggleDebug: () => void;
  /** Explicitly set debug mode. */
  setDebugEnabled: (enabled: boolean) => void;
  /** Chronological log of A2UI action dispatches (visible in debug panel). */
  actionLog: ActionDebugEvent[];
  /** Append an action event to the log. */
  logAction: (event: ActionDebugEvent) => void;
  /** Clear the action log (e.g. on session reset). */
  clearActionLog: () => void;
}

const DebugContext = createContext<DebugContextValue | null>(null);

function readInitialDebugState(): boolean {
  // URL param takes priority
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === 'true') return true;
  }
  // Then localStorage
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }
  return false;
}

export function DebugProvider({ children }: { children: ReactNode }) {
  const [debugEnabled, setDebugState] = useState(readInitialDebugState);
  const actionLogRef = useRef<ActionDebugEvent[]>([]);
  const [actionLog, setActionLog] = useState<ActionDebugEvent[]>([]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(debugEnabled));
  }, [debugEnabled]);

  // Keyboard shortcut: Ctrl+Shift+D
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setDebugState(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleDebug = useCallback(() => {
    setDebugState(prev => !prev);
  }, []);

  const setDebugEnabled = useCallback((enabled: boolean) => {
    setDebugState(enabled);
  }, []);

  const logAction = useCallback((event: ActionDebugEvent) => {
    actionLogRef.current = [...actionLogRef.current, event];
    setActionLog(actionLogRef.current);
  }, []);

  const clearActionLog = useCallback(() => {
    actionLogRef.current = [];
    setActionLog([]);
  }, []);

  return (
    <DebugContext.Provider value={{ debugEnabled, toggleDebug, setDebugEnabled, actionLog, logAction, clearActionLog }}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug(): DebugContextValue {
  const ctx = useContext(DebugContext);
  if (!ctx) throw new Error('useDebug must be used within a DebugProvider');
  return ctx;
}
