import React, { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { Layout } from './components/Layout';
import { Landing } from './components/Landing';
import { ChatShell } from './components/Chat/ChatShell';
import { SessionsSidebar } from './components/Sidebar/SessionsSidebar';
import { FileEditor } from './components/FileEditor/FileEditor';
import { FileTreePanel } from './components/FileTreePanel';
import { FileManagerSidebar } from './components/FileManager/FileManagerSidebar';
import { FileViewer } from './components/FileManager/FileViewer';
import { Playground } from './pages/Playground';
import { useA2UI } from './hooks/useA2UI';
import { useActionDispatch } from './hooks/useActionDispatch';
import { useProgressiveQueue } from './hooks/useProgressiveQueue';
import { useSessions } from './hooks/useSessions';
import { useStreaming } from './hooks/useStreaming';
import { useMockStreaming } from './hooks/useMockStreaming';
import { useAPIConnectorRegistry } from './contexts/APIConnectorContext';
import { useTheme } from './contexts/ThemeContext';
import { useDebug } from './contexts/DebugContext';
import { useVirtualFS } from './contexts/VirtualFSContext';
import { healthCheck } from './services/api-client';
import { isMockMode, isPlaygroundMode } from './services/mock-streaming';
import { VirtualFileSystem } from './services/virtual-fs';
import type { AppMode, ChatMessage, A2uiMsg } from './types';
// A2uiClientAction type no longer needed — actions route through useActionDispatch only

const mockEnabled = isMockMode();
const playgroundEnabled = isPlaygroundMode();

let msgSeq = 0;
function msgId(role: string) {
  return `msg-${Date.now()}-${++msgSeq}-${role}`;
}

export function App() {
  const { resolvedTheme } = useTheme();
  const { debugEnabled } = useDebug();
  const fluentTheme = resolvedTheme === 'dark' ? webDarkTheme : webLightTheme;

  const [mode, setMode] = useState<AppMode>(playgroundEnabled ? 'chat' : 'landing');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isApiAvailable, setIsApiAvailable] = useState<boolean | null>(mockEnabled ? true : null);
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [filePanelOpen, setFilePanelOpen] = useState(true);
  const [fileSidebarOpen, setFileSidebarOpen] = useState(false);
  const [viewerFile, setViewerFile] = useState<string | undefined>();

  const connectorRegistry = useAPIConnectorRegistry();

  const { handler: actionHandler, resetConsecutiveCount } = useActionDispatch({
    onSendMessage: (msg) => handleSendMessage(msg),
    onAutoContinue: (msg) => handleSendMessage(msg, true),
    connectorRegistry,
  });

  const a2ui = useA2UI({ actionHandler });
  const sessions = useSessions();
  const streaming = useStreaming();
  const mockStreaming = useMockStreaming();
  const progressiveQueue = useProgressiveQueue();

  // Single VFS instance for the app lifetime
  const fs = useMemo(() => new VirtualFileSystem(), []);

  // IndexedDB-backed persistent filesystem (provided via context)
  const { fs: vfs, files: vfsFiles, fileRecords: vfsFileRecords } = useVirtualFS();

  // Sync in-memory VFS → IndexedDB when files complete (with deduplication)
  const lastPersistedRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const unsub = fs.subscribe(() => {
      const snapshot = fs.getSnapshot();
      for (const file of snapshot) {
        if (file.status === 'complete') {
          const prev = lastPersistedRef.current.get(file.path);
          if (prev !== file.content) {
            lastPersistedRef.current.set(file.path, file.content);
            vfs.writeFile(file.path, file.content, file.language).catch((err) => {
              console.error(`[VFS sync] failed to persist ${file.path}:`, err);
            });
          }
        }
      }
    });
    return unsub;
  }, [fs, vfs]);

  // Messages for the active session
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Current conversation phase from SSE events
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const currentPhaseRef = useRef<string | null>(null);

  // Surface IDs revealed progressively via the queue
  const streamingSurfaceIdsRef = useRef<string[]>([]);

  // Raw A2UI messages accumulated during streaming (for session persistence)
  const streamingA2UIMessagesRef = useRef<A2uiMsg[]>([]);

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

  const handleSendMessage = useCallback(async (text: string, isAutoContinue = false) => {
    // Manual messages reset the consecutive auto-continue counter
    if (!isAutoContinue) {
      resetConsecutiveCount();
    }

    // Ensure we have an active session
    let sessionId = sessions.activeSessionId;
    if (!sessionId) {
      const newSession = sessions.createSession(text);
      sessionId = newSession.id;
    }

    // Add user message (auto-continue shows a subtle indicator instead of the full text)
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      text,
      timestamp: Date.now(),
      isAutoContinue,
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

    // Reset streaming surface IDs for the new turn
    streamingSurfaceIdsRef.current = [];
    streamingA2UIMessagesRef.current = [];
    progressiveQueue.reset();

    // Use mock streaming when ?mock is active, real streaming otherwise
    if (mockEnabled) {
      mockStreaming.send(text, sessionId, {
        onDelta: () => {},
        onA2UI: (msgs) => {
          streamingA2UIMessagesRef.current = [...streamingA2UIMessagesRef.current, ...msgs];
          const newIds = a2ui.processMessages(msgs);
          if (newIds.length > 0) {
            streamingSurfaceIdsRef.current = [...streamingSurfaceIdsRef.current, ...newIds];
            progressiveQueue.enqueue(newIds);
          }
        },
        onPhase: (phase) => { setCurrentPhase(phase); currentPhaseRef.current = phase; },
        onComplete: (fullText, model) => {
          const phase = currentPhaseRef.current || undefined;
          setCurrentPhase(null);
          currentPhaseRef.current = null;
          progressiveQueue.flush();
          const collectedIds = streamingSurfaceIdsRef.current;
          const surfaceIds = collectedIds.length > 0 ? collectedIds : undefined;
          const a2uiMessages = streamingA2UIMessagesRef.current.length > 0 ? [...streamingA2UIMessagesRef.current] : undefined;
          streamingSurfaceIdsRef.current = [];
          streamingA2UIMessagesRef.current = [];
          progressiveQueue.reset();
          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            text: fullText,
            model,
            surfaceIds,
            phase,
            timestamp: Date.now(),
            a2uiMessages,
          };
          setMessages(prev => [...prev, assistantMsg]);
          sessions.addMessage(sessionId!, assistantMsg);
        },
        onError: (error) => {
          streamingSurfaceIdsRef.current = [];
          streamingA2UIMessagesRef.current = [];
          progressiveQueue.reset();
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
      // For real streaming, use the backend session ID if available
      const activeSession = sessions.getActiveSession();
      const backendSessionId = activeSession?.backendSessionId;
      
      streaming.send(text, backendSessionId, {
        onDelta: () => {},
        onA2UI: (msgs) => {
          streamingA2UIMessagesRef.current = [...streamingA2UIMessagesRef.current, ...msgs];
          const newIds = a2ui.processMessages(msgs);
          if (newIds.length > 0) {
            streamingSurfaceIdsRef.current = [...streamingSurfaceIdsRef.current, ...newIds];
            progressiveQueue.enqueue(newIds);
          }
        },
        onPhase: (phase) => { setCurrentPhase(phase); currentPhaseRef.current = phase; },
        onComplete: (fullText, model, receivedSessionId, debugInfo) => {
          const phase = currentPhaseRef.current || undefined;
          setCurrentPhase(null);
          currentPhaseRef.current = null;
          // Store the backend session ID on first response
          if (receivedSessionId && !activeSession?.backendSessionId) {
            sessions.updateSession(sessionId!, { backendSessionId: receivedSessionId });
          }
          progressiveQueue.flush();
          const collectedIds = streamingSurfaceIdsRef.current;
          const surfaceIds = collectedIds.length > 0 ? collectedIds : undefined;
          const a2uiMessages = streamingA2UIMessagesRef.current.length > 0 ? [...streamingA2UIMessagesRef.current] : undefined;
          streamingSurfaceIdsRef.current = [];
          streamingA2UIMessagesRef.current = [];
          progressiveQueue.reset();
          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            text: fullText,
            model,
            surfaceIds,
            phase,
            timestamp: Date.now(),
            debugInfo,
            a2uiMessages,
          };
          setMessages(prev => [...prev, assistantMsg]);
          sessions.addMessage(sessionId!, assistantMsg);
        },
        onError: (error) => {
          streamingSurfaceIdsRef.current = [];
          streamingA2UIMessagesRef.current = [];
          progressiveQueue.reset();
          const errorMsg: ChatMessage = {
            id: `msg-${Date.now()}-error`,
            role: 'assistant',
            text: `⚠️ ${error}`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, errorMsg]);
          sessions.addMessage(sessionId!, errorMsg);
        },
      }, debugEnabled, activeSession?.messages ?? []);
    }
  }, [sessions, streaming, mockStreaming, a2ui, isApiAvailable, resetConsecutiveCount, progressiveQueue, debugEnabled]);

  const handleStartChat = useCallback((prompt: string) => {
    a2ui.reset();
    fs.clear();
    void vfs.clear();
    setSelectedFile(undefined);
    setViewerFile(undefined);
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
  }, [sessions, a2ui, handleSendMessage, fs, vfs]);

  const handleClearAllSessions = useCallback(() => {
    sessions.clearAllSessions();
    setMessages([]);
    a2ui.reset();
    fs.clear();
    void vfs.clear();
    setSelectedFile(undefined);
    setViewerFile(undefined);
  }, [sessions, a2ui, fs, vfs]);

  const handleNewSession = useCallback(() => {
    a2ui.reset();
    fs.clear();
    void vfs.clear();
    setSelectedFile(undefined);
    setViewerFile(undefined);
    setMessages([]);
    setMode('landing');
    document.body.classList.add('on-landing');
    sessions.setActiveSessionId(null);
  }, [a2ui, sessions, fs, vfs]);

  const handleResumeSession = useCallback((sessionId: string) => {
    sessions.setActiveSessionId(sessionId);
    const session = sessions.sessions.find(s => s.id === sessionId);
    if (session) {
      // Rehydrate A2UI surfaces from stored messages so components render after reload
      a2ui.reset();
      for (const msg of session.messages) {
        if (msg.a2uiMessages && msg.a2uiMessages.length > 0) {
          a2ui.processMessages(msg.a2uiMessages);
        }
      }
      setMessages(session.messages);
      setMode('chat');
      document.body.classList.remove('on-landing');
    }
  }, [sessions, a2ui]);

  const isStreaming = mockEnabled ? mockStreaming.isStreaming : streaming.isStreaming;
  const currentStreamText = mockEnabled ? mockStreaming.streamText : streaming.streamText;
  const fsFiles = useSyncExternalStore(fs.subscribe, fs.getSnapshot);
  const hasFiles = fsFiles.length > 0 || vfsFiles.length > 0;

  // Auto-show file sidebar when files appear
  const hadFilesRef = useRef(false);
  useEffect(() => {
    if (hasFiles && !hadFilesRef.current) {
      setFilePanelOpen(true);
      setFileSidebarOpen(true);
    }
    hadFilesRef.current = hasFiles;
  }, [hasFiles]);

  const handleToggleFilePanel = useCallback(() => {
    setFileSidebarOpen((prev) => !prev);
    setFilePanelOpen((prev) => !prev);
  }, []);

  // Handle file selection from the sidebar — open in the viewer
  const handleViewerSelectFile = useCallback(async (path: string) => {
    setViewerFile(path);
  }, []);

  const handleCloseViewer = useCallback(() => {
    setViewerFile(undefined);
  }, []);

  // Download all files as ZIP
  const [isZipDownloading, setIsZipDownloading] = useState(false);
  const handleDownloadAllZip = useCallback(async () => {
    if (isZipDownloading) return;
    setIsZipDownloading(true);
    try {
      const blob = await vfs.exportZip();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'kickstart-files.zip';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } finally {
      setIsZipDownloading(false);
    }
  }, [vfs, isZipDownloading]);

  // Delete selected file from IndexedDB VFS
  const handleDeleteViewerFile = useCallback(async () => {
    if (!viewerFile) return;
    await vfs.deleteFile(viewerFile);
    setViewerFile(undefined);
  }, [vfs, viewerFile]);

  // Resolve the file for the viewer from either streaming or persisted VFS
  const viewerStreamingFile = useMemo(
    () => viewerFile ? fs.read(viewerFile) : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewerFile, fsFiles],
  );
  const [viewerPersistedFile, setViewerPersistedFile] = useState<import('./services/virtual-fs').VFSFile | null>(null);
  useEffect(() => {
    if (!viewerFile) {
      setViewerPersistedFile(null);
      return;
    }
    if (viewerStreamingFile) {
      setViewerPersistedFile(null);
      return;
    }
    vfs.getFile(viewerFile)
      .then(setViewerPersistedFile)
      .catch(() => setViewerPersistedFile(null));
  }, [viewerFile, viewerStreamingFile, vfs, vfsFiles]);

  // Playground mode — standalone A2UI test harness
  if (playgroundEnabled) {
    return (
      <FluentProvider theme={fluentTheme}>
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
    <FluentProvider theme={fluentTheme}>
      <Layout
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        onNewSession={handleNewSession}
        showSessionsToggle={mode === 'chat'}
        hasFiles={hasFiles && filePanelOpen}
        showFilePanel={mode === 'chat' && filePanelOpen}
        showFileSidebar={mode === 'chat' && fileSidebarOpen}
        showFileViewer={mode === 'chat' && !!viewerFile}
        onToggleFilePanel={mode === 'chat' && hasFiles ? handleToggleFilePanel : undefined}
        sidebar={mode === 'chat' ? (
          <SessionsSidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            sessions={sessions.sessions}
            activeSessionId={sessions.activeSessionId}
            onSelectSession={handleResumeSession}
            onNewSession={handleNewSession}
            onDeleteSession={sessions.deleteSession}
          />
        ) : undefined}
        fileManagerSidebar={mode === 'chat' ? (
          <FileManagerSidebar
            streamingFiles={fsFiles}
            persistedFiles={vfsFileRecords}
            selectedPath={viewerFile}
            onSelectFile={handleViewerSelectFile}
            onClose={() => setFileSidebarOpen(false)}
            onDownloadAll={hasFiles ? handleDownloadAllZip : undefined}
            isDownloading={isZipDownloading}
          />
        ) : undefined}
        fileViewer={mode === 'chat' && viewerFile ? (
          <FileViewer
            streamingFile={viewerStreamingFile}
            persistedFile={viewerPersistedFile}
            onClose={handleCloseViewer}
            onDelete={handleDeleteViewerFile}
          />
        ) : undefined}
        fileEditor={mode === 'chat' ? (
          <>
            <FileEditor
              fs={fs}
              selectedPath={selectedFile}
              onSelectFile={setSelectedFile}
            />
            <FileTreePanel />
          </>
        ) : undefined}
      >
        {mode === 'landing' ? (
          <Landing
            onStartChat={handleStartChat}
            recentSessions={sessions.recentSessions}
            onResumeSession={handleResumeSession}
            onDeleteSession={sessions.deleteSession}
            onClearAllSessions={handleClearAllSessions}
          />
        ) : (
          <ChatShell
            messages={messages}
            isStreaming={isStreaming}
            streamingText={currentStreamText}
            streamingSurfaceIds={progressiveQueue.visibleIds}
            currentPhase={currentPhase}
            onSend={handleSendMessage}
            getSurface={a2ui.getSurface}
            debugEnabled={debugEnabled}
          />
        )}
      </Layout>
    </FluentProvider>
  );
}
