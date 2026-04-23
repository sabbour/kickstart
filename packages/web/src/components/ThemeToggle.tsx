import React from 'react';
import { useTheme, type ThemeMode } from '../contexts/ThemeContext';

const LABELS: Record<ThemeMode, string> = {
  light: 'Light mode — click for dark',
  dark: 'Dark mode — click for system',
  system: 'System mode — click for light',
};

const ICONS: Record<ThemeMode, React.ReactNode> = {
  light: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 1.78a1 1 0 011.415 1.415l-.708.707a1 1 0 01-1.414-1.414l.707-.708zM18 9a1 1 0 110 2h-1a1 1 0 110-2h1zM4 10a1 1 0 01-1 1H2a1 1 0 110-2h1a1 1 0 011 1zm1.49-5.51a1 1 0 010 1.414l-.707.707A1 1 0 013.37 5.2l.707-.707a1 1 0 011.414 0zM10 14a4 4 0 100-8 4 4 0 000 8zm0 2a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm5.637-2.073a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.415l-.707-.708a1 1 0 010-1.414zM4.783 14.634a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0z" />
    </svg>
  ),
  dark: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.003 8.003 0 1010.586 10.586z" />
    </svg>
  ),
  system: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1.5.5v8h11v-8h-11zM7 16h6v1H7v-1z" />
    </svg>
  ),
};

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className="topbar-btn"
      aria-label={LABELS[theme]}
      title={LABELS[theme]}
      onClick={toggleTheme}
    >
      {ICONS[theme]}
    </button>
  );
}
