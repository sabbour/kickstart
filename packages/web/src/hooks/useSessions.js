import { useState, useCallback, useEffect } from 'react';
const STORAGE_KEY = 'kickstart-sessions';
function loadSessions() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    }
    catch {
        return [];
    }
}
function saveSessions(sessions) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
    catch { /* quota exceeded — silently fail */ }
}
export function useSessions() {
    const [sessions, setSessions] = useState(loadSessions);
    const [activeSessionId, setActiveSessionId] = useState(null);
    useEffect(() => {
        saveSessions(sessions);
    }, [sessions]);
    const createSession = useCallback((firstMessage) => {
        const session = {
            id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: firstMessage.slice(0, 80),
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        setSessions(prev => [session, ...prev]);
        setActiveSessionId(session.id);
        return session;
    }, []);
    const addMessage = useCallback((sessionId, message) => {
        setSessions(prev => prev.map(s => {
            if (s.id !== sessionId)
                return s;
            return {
                ...s,
                messages: [...s.messages, message],
                updatedAt: Date.now(),
            };
        }));
    }, []);
    const updateMessage = useCallback((sessionId, messageId, updates) => {
        setSessions(prev => prev.map(s => {
            if (s.id !== sessionId)
                return s;
            return {
                ...s,
                messages: s.messages.map(m => m.id === messageId ? { ...m, ...updates } : m),
                updatedAt: Date.now(),
            };
        }));
    }, []);
    const updateSession = useCallback((sessionId, updates) => {
        setSessions(prev => prev.map(s => {
            if (s.id !== sessionId)
                return s;
            return {
                ...s,
                ...updates,
                updatedAt: Date.now(),
            };
        }));
    }, []);
    const deleteSession = useCallback((sessionId) => {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (activeSessionId === sessionId) {
            setActiveSessionId(null);
        }
    }, [activeSessionId]);
    const clearAllSessions = useCallback(() => {
        setSessions([]);
        setActiveSessionId(null);
        // Clear localStorage synchronously so it persists even if the
        // component unmounts before the useEffect fires.
        try {
            localStorage.removeItem(STORAGE_KEY);
        }
        catch { /* ignore */ }
    }, []);
    const getActiveSession = useCallback(() => {
        return sessions.find(s => s.id === activeSessionId);
    }, [sessions, activeSessionId]);
    const recentSessions = sessions.slice(0, 10);
    return {
        sessions,
        activeSessionId,
        setActiveSessionId,
        createSession,
        addMessage,
        updateMessage,
        updateSession,
        deleteSession,
        clearAllSessions,
        getActiveSession,
        recentSessions,
    };
}
//# sourceMappingURL=useSessions.js.map