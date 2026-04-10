import React from 'react';
import { Topbar } from './Topbar';

interface LayoutProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewSession: () => void;
  showSessionsToggle: boolean;
  sidebar?: React.ReactNode;
  fileEditor?: React.ReactNode;
  hasFiles?: boolean;
  children: React.ReactNode;
}

export function Layout({
  sidebarOpen: _sidebarOpen,
  onToggleSidebar,
  onNewSession,
  showSessionsToggle,
  sidebar,
  fileEditor,
  hasFiles,
  children,
}: LayoutProps) {
  return (
    <div className="app-shell">
      <Topbar
        onToggleSidebar={onToggleSidebar}
        onNewSession={onNewSession}
        showSessionsToggle={showSessionsToggle}
      />
      <div className={`app-layout${hasFiles ? ' has-files' : ''}`}>
        {sidebar}
        <main className="chat-main" role="main">
          {children}
        </main>
        {fileEditor}
      </div>
    </div>
  );
}
