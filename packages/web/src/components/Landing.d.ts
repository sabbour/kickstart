import React from 'react';
import type { Session } from '../types';
interface LandingProps {
    onStartChat: (prompt: string) => void;
    recentSessions: Session[];
    onResumeSession: (sessionId: string) => void;
    onDeleteSession: (sessionId: string) => void;
    onClearAllSessions: () => void;
}
export declare function Landing({ onStartChat, recentSessions, onResumeSession, onDeleteSession, onClearAllSessions }: LandingProps): React.JSX.Element;
export {};
//# sourceMappingURL=Landing.d.ts.map