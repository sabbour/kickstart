import React from 'react';
import { Topbar } from './Topbar';

interface LayoutProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewSession: () => void;
  showSessionsToggle: boolean;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}

export function Layout({
  sidebarOpen,
  onToggleSidebar,
  onNewSession,
  showSessionsToggle,
  sidebar,
  children,
}: LayoutProps) {
  return (
    <div className="app-shell">
      <Topbar
        onToggleSidebar={onToggleSidebar}
        onNewSession={onNewSession}
        showSessionsToggle={showSessionsToggle}
      />
      <div className="app-layout">
        {sidebar}
        <main className="chat-main" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}
