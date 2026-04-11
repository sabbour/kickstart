import React from 'react';
import { Topbar } from './Topbar';
export function Layout({ sidebarOpen: _sidebarOpen, onToggleSidebar, onNewSession, showSessionsToggle, sidebar, fileEditor, hasFiles, children, }) {
    return (<div className="app-shell">
      <Topbar onToggleSidebar={onToggleSidebar} onNewSession={onNewSession} showSessionsToggle={showSessionsToggle}/>
      <div className={`app-layout${hasFiles ? ' has-files' : ''}`}>
        {sidebar}
        <main className="chat-main" role="main">
          {children}
        </main>
        {fileEditor}
      </div>
    </div>);
}
//# sourceMappingURL=Layout.js.map