import React, { useState } from 'react';
import type { Session } from '../../types';

interface SessionsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
}

export function SessionsSidebar({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: SessionsSidebarProps) {
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setConfirmingDeleteId(sessionId);
  };

  const confirmDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    onDeleteSession(sessionId);
    setConfirmingDeleteId(null);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingDeleteId(null);
  };
  return (
    <aside id="sessions-sidebar" className={`sessions-sidebar${isOpen ? '' : ' hidden'}`} aria-label="Sessions">
      <div className="sessions-header">
        <span>Sessions</span>
        <button id="sessions-close-btn" className="sessions-close-btn" onClick={onClose} aria-label="Close sessions" title="Close">
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
            onClick={() => {
              if (confirmingDeleteId !== session.id) onSelectSession(session.id);
            }}
          >
            {confirmingDeleteId === session.id ? (
              <div className="session-confirm-delete">
                <span className="session-confirm-label">Delete?</span>
                <button className="session-confirm-yes" onClick={e => confirmDelete(e, session.id)} aria-label="Confirm delete">Yes</button>
                <button className="session-confirm-no" onClick={cancelDelete} aria-label="Cancel delete">No</button>
              </div>
            ) : (
              <>
                <span className="session-indicator" />
                <span className="session-title">{session.title}</span>
                <button
                  className="session-delete-btn"
                  onClick={e => handleDeleteClick(e, session.id)}
                  aria-label={`Delete session: ${session.title}`}
                  title="Delete session"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M8.5 4h3a1.5 1.5 0 00-3 0zm-1 0a2.5 2.5 0 015 0h5a.5.5 0 010 1h-1.05l-1.2 10.34A3 3 0 0112.27 18H7.73a3 3 0 01-2.98-2.66L3.55 5H2.5a.5.5 0 010-1h5zM5.74 15.23A2 2 0 007.73 17h4.54a2 2 0 001.99-1.77L15.44 5H4.56l1.18 10.23zM8.5 7.5a.5.5 0 01.5.5v7a.5.5 0 01-1 0V8a.5.5 0 01.5-.5zm3 0a.5.5 0 01.5.5v7a.5.5 0 01-1 0V8a.5.5 0 01.5-.5z" />
                  </svg>
                </button>
              </>
            )}
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
