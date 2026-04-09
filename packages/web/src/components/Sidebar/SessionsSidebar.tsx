import React from 'react';
import type { Session } from '../../types';

interface SessionsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

export function SessionsSidebar({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
}: SessionsSidebarProps) {
  return (
    <aside className={`sessions-sidebar${isOpen ? '' : ' hidden'}`} aria-label="Sessions">
      <div className="sessions-header">
        <span>Sessions</span>
        <button className="sessions-close-btn" onClick={onClose} aria-label="Close sessions" title="Close">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4.09 4.22a.5.5 0 01.63-.06l.07.06L10 9.44l5.22-5.22a.5.5 0 01.63-.06l.07.06a.5.5 0 01.06.63l-.06.07L10.7 10.1l5.22 5.22a.5.5 0 01-.63.76l-.07-.06L10 10.8l-5.22 5.22a.5.5 0 01-.63.06l-.07-.06a.5.5 0 01-.06-.63l.06-.07 5.22-5.22-5.22-5.22a.5.5 0 01-.06-.63l.06-.07z" />
          </svg>
        </button>
      </div>
      <div className="sessions-list">
        {sessions.length === 0 && (
          <div className="session-item" style={{ opacity: 0.5, cursor: 'default' }}>
            No sessions yet
          </div>
        )}
        {sessions.map(session => (
          <div
            key={session.id}
            className={`session-item${session.id === activeSessionId ? ' active' : ''}`}
            onClick={() => onSelectSession(session.id)}
          >
            <span className="session-indicator" />
            {session.title}
          </div>
        ))}
      </div>
      <div className="sessions-footer">
        <button className="sessions-new-btn" onClick={onNewSession} aria-label="New session" title="New session">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2.5a.5.5 0 01.5.5v4.5H13a.5.5 0 010 1H8.5V13a.5.5 0 01-1 0V8.5H3a.5.5 0 010-1h4.5V3a.5.5 0 01.5-.5z" />
          </svg>
          New session
        </button>
      </div>
    </aside>
  );
}
