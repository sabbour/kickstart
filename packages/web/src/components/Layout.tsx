import React from 'react';
import { Topbar } from './Topbar';

interface LayoutProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewSession: () => void;
  showSessionsToggle: boolean;
  sidebar?: React.ReactNode;
  fileManagerSidebar?: React.ReactNode;
  fileViewer?: React.ReactNode;
  hasFiles?: boolean;
  showFilePanel?: boolean;
  showFileSidebar?: boolean;
  showFileViewer?: boolean;
  onToggleFilePanel?: () => void;
  children: React.ReactNode;
}

export function Layout({
  sidebarOpen: _sidebarOpen,
  onToggleSidebar,
  onNewSession,
  showSessionsToggle,
  sidebar,
  fileManagerSidebar,
  fileViewer,
  hasFiles,
  showFilePanel,
  showFileSidebar,
  showFileViewer,
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
        {showFileSidebar && fileManagerSidebar}
        <main className="chat-main" role="main">
          {children}
        </main>
        {showFileViewer && fileViewer}
      </div>
    </div>
  );
}
