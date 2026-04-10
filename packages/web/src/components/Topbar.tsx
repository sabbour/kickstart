import React from 'react';

interface TopbarProps {
  onToggleSidebar: () => void;
  onNewSession: () => void;
  showSessionsToggle: boolean;
}

export function Topbar({ onToggleSidebar, showSessionsToggle }: TopbarProps) {
  return (
    <header className="topbar" role="banner">
      <a className="topbar-brand" href="#/" aria-label="Kickstart — home">
        <img src="assets/icons/compute/aks-automatic.svg" alt="" width="24" height="24" />
        <span>Kickstart on Azure Kubernetes Service (AKS)</span>
      </a>
      <div className="topbar-actions">
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
        <button className="topbar-user" aria-label="Sign in">
          <span className="topbar-avatar">?</span>
          <span>Sign in</span>
        </button>
      </div>
    </header>
  );
}
