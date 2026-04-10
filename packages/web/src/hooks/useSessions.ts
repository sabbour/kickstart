import { useState, useCallback, useEffect } from 'react';
import type { Session, ChatMessage } from '../types';

const STORAGE_KEY = 'kickstart-sessions';

function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: Session[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch { /* quota exceeded — silently fail */ }
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  const createSession = useCallback((firstMessage: string): Session => {
    const session: Session = {
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

  const addMessage = useCallback((sessionId: string, message: ChatMessage) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        messages: [...s.messages, message],
        updatedAt: Date.now(),
      };
    }));
  }, []);

  const updateMessage = useCallback((sessionId: string, messageId: string, updates: Partial<ChatMessage>) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        messages: s.messages.map(m =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
        updatedAt: Date.now(),
      };
    }));
  }, []);

  const updateSession = useCallback((sessionId: string, updates: Partial<Session>) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        ...updates,
        updatedAt: Date.now(),
      };
    }));
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
    }
  }, [activeSessionId]);

  const clearAllSessions = useCallback(() => {
    setSessions([]);
    setActiveSessionId(null);
  }, []);

  const getActiveSession = useCallback((): Session | undefined => {
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
