import React, { useState, useCallback, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Landing } from './components/Landing';
import { ChatShell } from './components/Chat/ChatShell';
import { SessionsSidebar } from './components/Sidebar/SessionsSidebar';
import { useA2UI } from './hooks/useA2UI';
import { useSessions } from './hooks/useSessions';
import { useStreaming } from './hooks/useStreaming';
import { getDemoResponse, resetDemoState } from './services/demo-scenarios';
import { healthCheck } from './services/api-client';
import type { AppMode, ChatMessage } from './types';

export function App() {
  const [mode, setMode] = useState<AppMode>('landing');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isApiAvailable, setIsApiAvailable] = useState(false);

  const a2ui = useA2UI();
  const sessions = useSessions();
  const streaming = useStreaming();

  // Messages for the active session (stored in component state for real-time updates)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [demoStreamText, setDemoStreamText] = useState('');
  const [isDemoStreaming, setIsDemoStreaming] = useState(false);

  // Check API availability on mount
  useEffect(() => {
    healthCheck().then(setIsApiAvailable);
  }, []);

  // Sync messages from session store when session changes
  useEffect(() => {
    const active = sessions.getActiveSession();
    if (active) {
      setMessages(active.messages);
    }
  }, [sessions.activeSessionId]);

  // Simulate streaming text for demo mode
  const simulateStreaming = useCallback(async (text: string): Promise<void> => {
    return new Promise(resolve => {
      let idx = 0;
      const words = text.split(' ');
      setDemoStreamText('');
      setIsDemoStreaming(true);

      const interval = setInterval(() => {
        idx++;
        const partial = words.slice(0, idx).join(' ');
        setDemoStreamText(partial);

        if (idx >= words.length) {
          clearInterval(interval);
          setIsDemoStreaming(false);
          setDemoStreamText('');
          resolve();
        }
      }, 40);
    });
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    // Ensure we have an active session
    let sessionId = sessions.activeSessionId;
    if (!sessionId) {
      const newSession = sessions.createSession(text);
      sessionId = newSession.id;
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    sessions.addMessage(sessionId!, userMsg);

    if (isApiAvailable) {
      // Real API mode
      streaming.send(text, sessionId, {
        onDelta: () => {},
        onA2UI: (msgs) => {
          a2ui.processMessages(msgs);
        },
        onPhase: () => {},
        onComplete: (fullText) => {
          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            text: fullText,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, assistantMsg]);
          sessions.addMessage(sessionId!, assistantMsg);
        },
        onError: (error) => {
          const errorMsg: ChatMessage = {
            id: `msg-${Date.now()}-error`,
            role: 'assistant',
            text: `⚠️ ${error}. Running in demo mode.`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, errorMsg]);
          // Fall back to demo
          handleDemoResponse(text, sessionId!);
        },
      });
    } else {
      await handleDemoResponse(text, sessionId);
    }
  }, [sessions, streaming, a2ui, isApiAvailable, simulateStreaming]);

  const handleDemoResponse = useCallback(async (userText: string, sessionId: string) => {
    const demo = getDemoResponse(userText);

    // Simulate typing delay
    await simulateStreaming(demo.text);

    // Process A2UI messages
    let surfaceIds: string[] = [];
    if (demo.a2uiMessages.length > 0) {
      surfaceIds = a2ui.processMessages(demo.a2uiMessages);
    }

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant',
      text: demo.text,
      surfaceIds,
      phase: demo.phase,
      model: demo.model,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, assistantMsg]);
    sessions.addMessage(sessionId, assistantMsg);
  }, [a2ui, sessions, simulateStreaming]);

  const handleStartChat = useCallback((prompt: string) => {
    resetDemoState();
    a2ui.reset();
    setMessages([]);
    setMode('chat');
    document.body.classList.remove('on-landing');

    // Create session and send first message after brief delay
    const session = sessions.createSession(prompt);
    setTimeout(() => {
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        text: prompt,
        timestamp: Date.now(),
      };
      setMessages([userMsg]);
      sessions.addMessage(session.id, userMsg);

      // Get demo response
      handleDemoResponse(prompt, session.id);
    }, 100);
  }, [sessions, a2ui, handleDemoResponse]);

  const handleNewSession = useCallback(() => {
    resetDemoState();
    a2ui.reset();
    setMessages([]);
    setMode('landing');
    document.body.classList.add('on-landing');
    sessions.setActiveSessionId(null);
  }, [a2ui, sessions]);

  const handleResumeSession = useCallback((sessionId: string) => {
    sessions.setActiveSessionId(sessionId);
    const session = sessions.sessions.find(s => s.id === sessionId);
    if (session) {
      setMessages(session.messages);
      setMode('chat');
      document.body.classList.remove('on-landing');
    }
  }, [sessions]);

  const isStreaming = streaming.isStreaming || isDemoStreaming;
  const currentStreamText = isDemoStreaming ? demoStreamText : streaming.streamText;

  return (
    <Layout
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen(prev => !prev)}
      onNewSession={handleNewSession}
      showSessionsToggle={mode === 'chat'}
      sidebar={mode === 'chat' ? (
        <SessionsSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sessions={sessions.sessions}
          activeSessionId={sessions.activeSessionId}
          onSelectSession={handleResumeSession}
          onNewSession={handleNewSession}
        />
      ) : undefined}
    >
      {mode === 'landing' ? (
        <Landing
          onStartChat={handleStartChat}
          recentSessions={sessions.recentSessions}
          onResumeSession={handleResumeSession}
          onDeleteSession={sessions.deleteSession}
        />
      ) : (
        <ChatShell
          messages={messages}
          isStreaming={isStreaming}
          streamingText={currentStreamText}
          onSend={handleSendMessage}
          getSurface={a2ui.getSurface}
        />
      )}
    </Layout>
  );
}
