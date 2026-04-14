import React from 'react';
import { ThemeToggle } from './ThemeToggle';
import { useDebug } from '../contexts/DebugContext';

interface TopbarProps {
  onToggleSidebar: () => void;
  onNewSession: () => void;
  showSessionsToggle: boolean;
}

export function Topbar({ onToggleSidebar, showSessionsToggle }: TopbarProps) {
  const { debugEnabled, toggleDebug } = useDebug();

  return (
    <header className="topbar" role="banner">
      <a className="topbar-brand" href="#/" aria-label="Kickstart — home">
        <span>Kickstart your app ideas on Azure</span>
      </a>
      <div className="topbar-actions">
        {debugEnabled && (
          <button
            className="topbar-btn topbar-debug-badge"
            aria-label="Debug mode active — click to disable"
            title="Debug mode ON (Ctrl+Shift+D to toggle)"
            onClick={toggleDebug}
          >
            🐛 Debug
          </button>
        )}
        {showSessionsToggle && (
          <button
            id="topbar-sessions-toggle"
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
        <ThemeToggle />
        <button
          className="topbar-signin"
          aria-label="Sign in with Microsoft"
          onClick={() => {
            window.location.href = '/.auth/login/aad?post_login_redirect_uri=/';
          }}
        >
          <svg
            className="topbar-signin-logo"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 21 21"
            aria-hidden="true"
          >
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          <span>Sign in with Microsoft</span>
        </button>
      </div>
    </header>
  );
}
