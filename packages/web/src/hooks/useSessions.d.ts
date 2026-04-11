import type { Session, ChatMessage } from '../types';
export declare function useSessions(): {
    sessions: Session[];
    activeSessionId: string | null;
    setActiveSessionId: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    createSession: (firstMessage: string) => Session;
    addMessage: (sessionId: string, message: ChatMessage) => void;
    updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void;
    updateSession: (sessionId: string, updates: Partial<Session>) => void;
    deleteSession: (sessionId: string) => void;
    clearAllSessions: () => void;
    getActiveSession: () => Session | undefined;
    recentSessions: Session[];
};
//# sourceMappingURL=useSessions.d.ts.map