import React, { createContext, useContext, useState, useCallback, useEffect, useSyncExternalStore, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  /** User-selected preference (light, dark, or system). */
  theme: ThemeMode;
  /** Resolved to light or dark — accounts for OS preference when theme is system. */
  resolvedTheme: ResolvedTheme;
  /** Set a specific theme mode. */
  setTheme: (mode: ThemeMode) => void;
  /** Cycle through light, dark, system. */
  toggleTheme: () => void;
}

const STORAGE_KEY = 'kickstart-theme';
const CYCLE: ThemeMode[] = ['light', 'dark', 'system'];

const darkMQ = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

function getSystemPreference(): ResolvedTheme {
  return darkMQ?.matches ? 'dark' : 'light';
}

/** Subscribe to OS color-scheme changes via useSyncExternalStore. */
function subscribeToMediaQuery(callback: () => void) {
  darkMQ?.addEventListener('change', callback);
  return () => darkMQ?.removeEventListener('change', callback);
}

function readSavedTheme(): ThemeMode {
  const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return 'system';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readSavedTheme);

  // Track OS preference reactively so system mode updates live.
  const systemPreference = useSyncExternalStore(
    subscribeToMediaQuery,
    getSystemPreference,
    () => 'light' as ResolvedTheme,
  );

  const resolved: ResolvedTheme = theme === 'system' ? systemPreference : theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, resolved]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const idx = CYCLE.indexOf(prev);
      return CYCLE[(idx + 1) % CYCLE.length];
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: resolved, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
