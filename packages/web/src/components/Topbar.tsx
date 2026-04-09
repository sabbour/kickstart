import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface TopbarProps {
  onToggleSidebar: () => void;
  onNewSession: () => void;
  showSessionsToggle: boolean;
}

export function Topbar({ onToggleSidebar, showSessionsToggle }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className="topbar" role="banner">
      <a className="topbar-brand" href="#/" aria-label="Kickstart — home">
        <img src="assets/icons/compute/aks-automatic.svg" alt="" width="24" height="24" />
        <span>Kickstart on Azure Kubernetes Service (AKS)</span>
      </a>
      <div className="topbar-actions">
        {showSessionsToggle && (
          <button
            className="topbar-btn"
            aria-label="Toggle sessions"
            title="Sessions"
            onClick={onToggleSidebar}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 4h14v1.5H3V4zm0 4h14v1.5H3V8zm0 4h10v1.5H3V12z" />
            </svg>
          </button>
        )}
        <button
          className="topbar-btn"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
          onClick={toggleTheme}
        >
          {isDark ? (
            /* Sun icon */
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1zm0 11a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1zm7-4a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1zM4 10a1 1 0 0 1-1 1H2a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1zm9.95-4.95a1 1 0 0 1 0 1.414l-.707.707a1 1 0 1 1-1.414-1.414l.707-.707a1 1 0 0 1 1.414 0zM7.172 13.536a1 1 0 0 1 0 1.414l-.707.707a1 1 0 1 1-1.414-1.414l.707-.707a1 1 0 0 1 1.414 0zm6.364 0a1 1 0 0 1 1.414 0l.707.707a1 1 0 1 1-1.414 1.414l-.707-.707a1 1 0 0 1 0-1.414zM5.757 5.05a1 1 0 0 1 1.415 0l.707.707A1 1 0 0 1 6.464 7.17l-.707-.707a1 1 0 0 1 0-1.414zM10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/>
            </svg>
          ) : (
            /* Moon icon */
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.293 13.293A8 8 0 0 1 6.707 2.707a8.001 8.001 0 1 0 10.586 10.586z"/>
            </svg>
          )}
        </button>
        <button className="topbar-user" aria-label="Sign in">
          <span className="topbar-avatar">?</span>
          <span>Sign in</span>
        </button>
      </div>
    </header>
  );
}
