import React, { useState, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { Layout } from './components/Layout';
import { Landing } from './components/Landing';
import { ChatShell } from './components/Chat/ChatShell';
import { SessionsSidebar } from './components/Sidebar/SessionsSidebar';
import { FileEditor } from './components/FileEditor/FileEditor';
import { Playground } from './pages/Playground';
import { useA2UI } from './hooks/useA2UI';
import { useSessions } from './hooks/useSessions';
import { useStreaming } from './hooks/useStreaming';
import { useMockStreaming } from './hooks/useMockStreaming';
import { healthCheck } from './services/api-client';
import { isMockMode, isPlaygroundMode } from './services/mock-streaming';
import { VirtualFileSystem } from './services/virtual-fs';
import type { AppMode, ChatMessage } from './types';

const mockEnabled = isMockMode();
const playgroundEnabled = isPlaygroundMode();

export function App() {
  const [mode, setMode] = useState<AppMode>(playgroundEnabled ? 'chat' : 'landing');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isApiAvailable, setIsApiAvailable] = useState<boolean | null>(mockEnabled ? true : null);
  const [selectedFile, setSelectedFile] = useState<string | undefined>();

  const a2ui = useA2UI();
  const sessions = useSessions();
  const streaming = useStreaming();
  const mockStreaming = useMockStreaming();

  // Single VFS instance for the app lifetime
  const fs = useMemo(() => new VirtualFileSystem(), []);

  // Messages for the active session
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Check API availability on mount (skip in mock mode — already true)
  useEffect(() => {
    if (!mockEnabled) {
      healthCheck().then(setIsApiAvailable);
    }
  }, []);

  // Sync messages from session store when session changes
  useEffect(() => {
    const active = sessions.getActiveSession();
    if (active) {
      setMessages(active.messages);
    }
  }, [sessions.activeSessionId]);

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

    if (!isApiAvailable) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        text: '⚠️ The API is not available. Please check that Azure OpenAI credentials are configured and the API is running.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
      sessions.addMessage(sessionId!, errorMsg);
      return;
    }

    // Use mock streaming when ?mock is active, real streaming otherwise
    if (mockEnabled) {
      mockStreaming.send(text, sessionId, {
        onDelta: () => {},
        onA2UI: (msgs) => {
          a2ui.processMessages(msgs);
        },
        onPhase: () => {},
        onComplete: (fullText, model) => {
          const surfaceIds = a2ui.surfaces.size > 0
            ? Array.from(a2ui.surfaces.keys())
            : undefined;
          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            text: fullText,
            model,
            surfaceIds,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, assistantMsg]);
          sessions.addMessage(sessionId!, assistantMsg);
        },
        onError: (error) => {
          const errorMsg: ChatMessage = {
            id: `msg-${Date.now()}-error`,
            role: 'assistant',
            text: `⚠️ ${error}`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, errorMsg]);
          sessions.addMessage(sessionId!, errorMsg);
        },
      });
    } else {
      streaming.send(text, sessionId, {
        onDelta: () => {},
        onA2UI: (msgs) => {
          a2ui.processMessages(msgs);
        },
        onPhase: () => {},
        onComplete: (fullText, model) => {
          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            text: fullText,
            model,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, assistantMsg]);
          sessions.addMessage(sessionId!, assistantMsg);
        },
        onError: (error) => {
          const errorMsg: ChatMessage = {
            id: `msg-${Date.now()}-error`,
            role: 'assistant',
            text: `⚠️ ${error}`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, errorMsg]);
          sessions.addMessage(sessionId!, errorMsg);
        },
      });
    }
  }, [sessions, streaming, mockStreaming, a2ui, isApiAvailable]);

  const handleStartChat = useCallback((prompt: string) => {
    a2ui.reset();
    fs.clear();
    setSelectedFile(undefined);
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

      // Send via real API
      handleSendMessage(prompt);
    }, 100);
  }, [sessions, a2ui, handleSendMessage, fs]);

  const handleNewSession = useCallback(() => {
    a2ui.reset();
    fs.clear();
    setSelectedFile(undefined);
    setMessages([]);
    setMode('landing');
    document.body.classList.add('on-landing');
    sessions.setActiveSessionId(null);
  }, [a2ui, sessions, fs]);

  const handleResumeSession = useCallback((sessionId: string) => {
    sessions.setActiveSessionId(sessionId);
    const session = sessions.sessions.find(s => s.id === sessionId);
    if (session) {
      setMessages(session.messages);
      setMode('chat');
      document.body.classList.remove('on-landing');
    }
  }, [sessions]);

  const isStreaming = mockEnabled ? mockStreaming.isStreaming : streaming.isStreaming;
  const currentStreamText = mockEnabled ? mockStreaming.streamText : streaming.streamText;
  const fsFiles = useSyncExternalStore(fs.subscribe, fs.getSnapshot);
  const hasFiles = fsFiles.length > 0;

  // Playground mode — standalone A2UI test harness
  if (playgroundEnabled) {
    return (
      <FluentProvider theme={webLightTheme}>
        <Layout
          sidebarOpen={false}
          onToggleSidebar={() => {}}
          onNewSession={() => {}}
          showSessionsToggle={false}
          hasFiles={false}
        >
          <Playground />
        </Layout>
      </FluentProvider>
    );
  }

  return (
    <FluentProvider theme={webLightTheme}>
      <Layout
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        onNewSession={handleNewSession}
        showSessionsToggle={mode === 'chat'}
        hasFiles={hasFiles}
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
        fileEditor={mode === 'chat' ? (
          <FileEditor
            fs={fs}
            selectedPath={selectedFile}
            onSelectFile={setSelectedFile}
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
    </FluentProvider>
  );
}
