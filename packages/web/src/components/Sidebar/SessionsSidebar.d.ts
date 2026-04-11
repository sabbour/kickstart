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
export declare function SessionsSidebar({ isOpen, onClose, sessions, activeSessionId, onSelectSession, onNewSession, }: SessionsSidebarProps): React.JSX.Element;
export {};
//# sourceMappingURL=SessionsSidebar.d.ts.map