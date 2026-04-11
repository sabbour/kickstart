import React from 'react';
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
export declare function Layout({ sidebarOpen: _sidebarOpen, onToggleSidebar, onNewSession, showSessionsToggle, sidebar, fileEditor, hasFiles, children, }: LayoutProps): React.JSX.Element;
export {};
//# sourceMappingURL=Layout.d.ts.map