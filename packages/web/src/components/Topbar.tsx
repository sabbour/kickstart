import React, { useState, useEffect, useRef } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { useDebug } from '../contexts/DebugContext';

interface AuthUser {
  userDetails: string;
  identityProvider: string;
}

/** Extract a display-friendly name from an email or raw identifier. */
function getDisplayName(userDetails: string): string {
  const local = userDetails.includes('@')
    ? userDetails.split('@')[0]
    : userDetails;
  return local
    .toLowerCase()
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

/** First letter for the avatar circle, derived from an already-computed display name. */
function getInitial(displayName: string): string {
  return displayName.charAt(0).toUpperCase();
}

interface TopbarProps {
  onToggleSidebar: () => void;
  onNewSession: () => void;
  showSessionsToggle: boolean;
  showFilePanelToggle?: boolean;
  filePanelOpen?: boolean;
  onToggleFilePanel?: () => void;
}

export function Topbar({
  onToggleSidebar,
  onNewSession,
  showSessionsToggle,
  showFilePanelToggle,
  filePanelOpen,
  onToggleFilePanel,
}: TopbarProps) {
  const { debugEnabled, toggleDebug } = useDebug();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch('/.auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const principal = data?.clientPrincipal;
        if (principal?.userDetails) {
          setUser({ userDetails: principal.userDetails, identityProvider: principal.identityProvider });
        }
      })
      .catch(() => { /* not authenticated or auth endpoint unavailable */ });
  }, []);

  return (
    <header className="topbar" role="banner">
      <a className="topbar-brand" href="#/" aria-label="Kickstart — home">
        <span className="sr-only">Home</span>
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
            className="topbar-btn"
            aria-label="Back to home"
            title="Home"
            onClick={onNewSession}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 2.69l7 6.3V17a1 1 0 01-1 1h-4v-5a1 1 0 00-1-1H9a1 1 0 00-1 1v5H4a1 1 0 01-1-1V8.99l7-6.3zm0-1.39a1 1 0 00-.67.26l-7.5 6.75A1 1 0 001.5 9v8.5A1.5 1.5 0 003 19h4.5a1.5 1.5 0 001.5-1.5V14h2v3.5a1.5 1.5 0 001.5 1.5H17a1.5 1.5 0 001.5-1.5V9a1 1 0 00-.33-.69l-7.5-6.75A1 1 0 0010 1.3z" />
            </svg>
          </button>
        )}
        {showFilePanelToggle && (
          <button
            className={`topbar-btn${filePanelOpen ? ' active' : ''}`}
            aria-label={filePanelOpen ? 'Hide files panel' : 'Show files panel'}
            aria-pressed={filePanelOpen}
            title={filePanelOpen ? 'Hide files' : 'Show files'}
            onClick={onToggleFilePanel}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M2 4.5A1.5 1.5 0 013.5 3h4.293a1.5 1.5 0 011.06.44l.708.706a.5.5 0 00.353.147H16.5A1.5 1.5 0 0118 5.793V15.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 012 15.5v-11zM3.5 4a.5.5 0 00-.5.5v11a.5.5 0 00.5.5h13a.5.5 0 00.5-.5V5.793a.5.5 0 00-.5-.5H9.914a1.5 1.5 0 01-1.06-.44l-.708-.706A.5.5 0 007.793 4H3.5z" />
            </svg>
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
        {user ? (
          <UserMenu user={user} />
        ) : (
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
        )}
      </div>
    </header>
  );
}

/* ── Authenticated user menu ─────────────────────────────────────────── */
function UserMenu({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const displayName = getDisplayName(user.userDetails);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="topbar-user-menu" ref={ref}>
      <button
        className="topbar-user-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`User menu for ${displayName}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="topbar-avatar" aria-hidden="true">
          {getInitial(displayName)}
        </span>
        <span className="topbar-user-name">{displayName}</span>
      </button>

      {open && (
        <div className="topbar-user-dropdown">
          <span className="topbar-user-dropdown-email">{user.userDetails}</span>
          <a
            href="/.auth/logout?post_logout_redirect_uri=/"
            className="topbar-user-dropdown-signout"
          >
            Sign out
          </a>
        </div>
      )}
    </div>
  );
}
