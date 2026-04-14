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
  showFilePanel?: boolean;
  onToggleFilePanel?: () => void;
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
  showFilePanel,
  onToggleFilePanel,
  children,
}: LayoutProps) {
  return (
    <div className="app-shell">
      <Topbar
        onToggleSidebar={onToggleSidebar}
        onNewSession={onNewSession}
        showSessionsToggle={showSessionsToggle}
        showFilePanelToggle={!!onToggleFilePanel}
        filePanelOpen={!!showFilePanel}
        onToggleFilePanel={onToggleFilePanel}
      />
      <div className={`app-layout${hasFiles ? ' has-files' : ''}`}>
        {sidebar}
        <main className="chat-main" role="main">
          {children}
        </main>
        {showFilePanel && fileEditor}
      </div>
    </div>
  );
}
