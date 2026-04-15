import React, { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { Layout } from './components/Layout';
import { Landing } from './components/Landing';
import { ChatShell } from './components/Chat/ChatShell';
import { SessionsSidebar } from './components/Sidebar/SessionsSidebar';
import { FileEditor } from './components/FileEditor/FileEditor';
import { FileTreePanel } from './components/FileTreePanel';
import { FileManagerSidebar, FileViewer } from './components/FileManager';
import { Playground } from './pages/Playground';
import { useA2UI } from './hooks/useA2UI';
import { useActionDispatch } from './hooks/useActionDispatch';
import { useProgressiveQueue } from './hooks/useProgressiveQueue';
import { useSessions } from './hooks/useSessions';
import { useNavigation } from './hooks/useNavigation';
import type { NavState } from './hooks/useNavigation';
import { useStreaming } from './hooks/useStreaming';
import { useMockStreaming } from './hooks/useMockStreaming';
import { useAPIConnectorRegistry } from './contexts/APIConnectorContext';
import { useArtifacts } from './contexts/ArtifactContext';
import { ConversationSessionProvider } from './contexts/ConversationSessionContext';
import { useTheme } from './contexts/ThemeContext';
import { useDebug } from './contexts/DebugContext';
import { useVirtualFS } from './contexts/VirtualFSContext';
import { healthCheck } from './services/api-client';
import { isMockMode, isPlaygroundMode } from './services/mock-streaming';
import { VirtualFileSystem } from './services/virtual-fs';
import {
  getLatestConversationPhase,
  normalizeConversationPhase,
  prepareChatA2ui,
  rebuildChatSessionState,
} from './utils/chat-a2ui';
import { summarizeTokenUsage } from './utils/chat-usage';
import type { AppMode, ChatMessage, A2uiPayloadItem, ConversationPhaseId } from './types';
// A2uiClientAction type no longer needed — actions route through useActionDispatch only

const mockEnabled = isMockMode();
const playgroundEnabled = isPlaygroundMode();

let msgSeq = 0;
function msgId(role: string) {
  return `msg-${Date.now()}-${++msgSeq}-${role}`;
}

export function App() {
  const { resolvedTheme } = useTheme();
  const { debugEnabled, logAction, clearActionLog } = useDebug();
  const fluentTheme = resolvedTheme === 'dark' ? webDarkTheme : webLightTheme;

  const [mode, setMode] = useState<AppMode>(playgroundEnabled ? 'chat' : 'landing');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isApiAvailable, setIsApiAvailable] = useState<boolean | null>(mockEnabled ? true : null);
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [filePanelOpen, setFilePanelOpen] = useState(true);
  const [fileSidebarOpen, setFileSidebarOpen] = useState(true);
  const [viewerFile, setViewerFile] = useState<string | undefined>();
  const selectedFileRef = useRef<string | undefined>(undefined);
  const viewerFileRef = useRef<string | undefined>(undefined);

  const connectorRegistry = useAPIConnectorRegistry();
  const { getArtifact } = useArtifacts();

  const { handler: actionHandler, resetConsecutiveCount } = useActionDispatch({
    onSendMessage: (msg) => handleSendMessage(msg),
    onAutoContinue: (msg) => handleSendMessage(msg, true),
    connectorRegistry,
    onDebugAction: debugEnabled ? (evt) => logAction({ ...evt, timestamp: Date.now() }) : undefined,
    onClientAction: (operation) => {
      if (operation === 'download-project') {
        handleDownloadZip();
      }
    },
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

  // Navigation: ref breaks circular dependency between nav callbacks and handlers
  const navHandlerRef = useRef<(state: NavState) => void>(() => {});
  const nav = useNavigation((state) => navHandlerRef.current(state));

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
  const [currentPhase, setCurrentPhase] = useState<ConversationPhaseId | null>(null);
  const currentPhaseRef = useRef<ConversationPhaseId | null>(null);

  // Surface IDs revealed progressively via the queue
  const streamingSurfaceIdsRef = useRef<string[]>([]);

  // Raw A2UI messages accumulated during streaming (for session persistence)
  const streamingA2UIMessagesRef = useRef<A2uiPayloadItem[]>([]);

  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  useEffect(() => {
    viewerFileRef.current = viewerFile;
  }, [viewerFile]);

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
      const phase = getLatestConversationPhase(active.messages);
      setCurrentPhase(phase);
      currentPhaseRef.current = phase;
    } else {
      setMessages([]);
      setCurrentPhase(null);
      currentPhaseRef.current = null;
    }
  }, [sessions.activeSessionId]);

  const setConversationPhase = useCallback((phase: string | null | undefined) => {
    const normalized = normalizeConversationPhase(phase);
    setCurrentPhase(normalized);
    currentPhaseRef.current = normalized;
  }, []);

  const openGeneratedFile = useCallback((path: string) => {
    selectedFileRef.current = path;
    viewerFileRef.current = path;
    setSelectedFile(path);
    setViewerFile(path);
  }, []);

  const resolveArtifactContent = useCallback((artifactPath: string) => {
    return getArtifact(artifactPath)?.content ?? null;
  }, [getArtifact]);

  const clearWorkspace = useCallback(async () => {
    a2ui.reset();
    fs.clear();
    lastPersistedRef.current = new Map();
    clearActionLog();
    selectedFileRef.current = undefined;
    viewerFileRef.current = undefined;
    setSelectedFile(undefined);
    setViewerFile(undefined);
    setConversationPhase(null);
    try {
      await vfs.clear();
    } catch (err) {
      console.error('[Workspace] failed to clear persisted files:', err);
    }
  }, [a2ui, fs, vfs, clearActionLog, setConversationPhase]);

  const processIncomingA2UI = useCallback((msgs: A2uiPayloadItem[], turnId: string) => {
    const prepared = prepareChatA2ui(msgs, turnId, {
      currentPhase: currentPhaseRef.current,
      resolveArtifactContent,
    });

    streamingA2UIMessagesRef.current = [
      ...streamingA2UIMessagesRef.current,
      ...prepared.storedMessages,
    ];

    if (prepared.phase) {
      setConversationPhase(prepared.phase);
    }

    for (const file of prepared.files) {
      fs.write(file.path, file.content, file.language);
    }

    if (prepared.files.length > 0 && !selectedFileRef.current && !viewerFileRef.current) {
      openGeneratedFile(prepared.files[0].path);
    }

    const newIds = a2ui.processMessages(prepared.renderableMessages);
    if (newIds.length > 0) {
      streamingSurfaceIdsRef.current = [...streamingSurfaceIdsRef.current, ...newIds];
      progressiveQueue.enqueue(newIds);
    }
  }, [resolveArtifactContent, fs, openGeneratedFile, a2ui, progressiveQueue, setConversationPhase]);

  const handleSendMessage = useCallback(async (text: string, isAutoContinue = false, explicitSessionId?: string) => {
    // Manual messages reset the consecutive auto-continue counter
    if (!isAutoContinue) {
      resetConsecutiveCount();
    }

    // Ensure we have an active session (use explicit ID to avoid stale closure)
    let sessionId = explicitSessionId ?? sessions.activeSessionId;
    if (!sessionId) {
      const newSession = sessions.createSession(text);
      sessionId = newSession.id;
      clearActionLog();
      setConversationPhase(null);
    }

    const assistantMessageId = msgId('assistant');

    // Add user message (auto-continue shows a subtle indicator instead of the full text)
    const userMsg: ChatMessage = {
      id: msgId(isAutoContinue ? 'auto-continue' : 'user'),
      role: 'user',
      text,
      timestamp: Date.now(),
      isAutoContinue,
    };
    setMessages(prev => [...prev, userMsg]);
    sessions.addMessage(sessionId!, userMsg);

    if (!isApiAvailable) {
      const errorMsg: ChatMessage = {
        id: msgId('error'),
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

    const handleIncomingA2UI = (payload: A2uiPayloadItem[]) => {
      processIncomingA2UI(payload, assistantMessageId);
    };

    // Use mock streaming when ?mock is active, real streaming otherwise
    if (mockEnabled) {
      mockStreaming.send(text, sessionId, {
        onDelta: () => {},
        onA2UI: handleIncomingA2UI,
        onPhase: (phase) => setConversationPhase(phase),
        onComplete: (fullText, model) => {
          const phase = currentPhaseRef.current || undefined;
          progressiveQueue.flush();
          const collectedIds = streamingSurfaceIdsRef.current;
          const surfaceIds = collectedIds.length > 0 ? collectedIds : undefined;
          const a2uiMessages = streamingA2UIMessagesRef.current.length > 0 ? [...streamingA2UIMessagesRef.current] : undefined;
          streamingSurfaceIdsRef.current = [];
          streamingA2UIMessagesRef.current = [];
          progressiveQueue.reset();
          const assistantMsg: ChatMessage = {
            id: assistantMessageId,
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
            id: msgId('error'),
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
        onA2UI: handleIncomingA2UI,
        onPhase: (phase) => setConversationPhase(phase),
        onComplete: (fullText, model, receivedSessionId, debugInfo, usage) => {
          const phase = currentPhaseRef.current || undefined;
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
            id: assistantMessageId,
            role: 'assistant',
            text: fullText,
            model,
            surfaceIds,
            phase,
            timestamp: Date.now(),
            debugInfo,
            a2uiMessages,
            ...(usage ? { usage: usage.turn } : {}),
          };
          setMessages(prev => [...prev, assistantMsg]);
          sessions.addMessage(sessionId!, assistantMsg);
        },
        onError: (error) => {
          streamingSurfaceIdsRef.current = [];
          streamingA2UIMessagesRef.current = [];
          progressiveQueue.reset();
          const errorMsg: ChatMessage = {
            id: msgId('error'),
            role: 'assistant',
            text: `⚠️ ${error}`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, errorMsg]);
          sessions.addMessage(sessionId!, errorMsg);
        },
      }, debugEnabled, activeSession?.messages ?? []);
    }
  }, [sessions, streaming, mockStreaming, isApiAvailable, resetConsecutiveCount, progressiveQueue, debugEnabled, clearActionLog, setConversationPhase, processIncomingA2UI]);

  const handleStartChat = useCallback(async (prompt: string) => {
    await clearWorkspace();
    setMessages([]);
    setMode('chat');
    document.body.classList.remove('on-landing');

    // Create session and send — pass explicit ID to avoid stale-closure duplicate
    const session = sessions.createSession(prompt);
    nav.pushSession(session.id);
    void handleSendMessage(prompt, false, session.id);
  }, [clearWorkspace, sessions, handleSendMessage, nav.pushSession]);

  const handleClearAllSessions = useCallback(async () => {
    sessions.clearAllSessions();
    setMessages([]);
    await clearWorkspace();
  }, [sessions, clearWorkspace]);

  const handleNewSession = useCallback(async (pushHistory = true) => {
    await clearWorkspace();
    setMessages([]);
    setMode('landing');
    document.body.classList.add('on-landing');
    sessions.setActiveSessionId(null);
    if (pushHistory) {
      nav.pushLanding();
    }
  }, [clearWorkspace, sessions, nav.pushLanding]);

  const handleResumeSession = useCallback(async (sessionId: string, pushHistory = true) => {
    sessions.setActiveSessionId(sessionId);
    const session = sessions.sessions.find(s => s.id === sessionId);
    if (session) {
      await clearWorkspace();
      const restored = rebuildChatSessionState(session.messages, {
        resolveArtifactContent,
      });

      if (restored.renderableMessages.length > 0) {
        a2ui.processMessages(restored.renderableMessages);
      }
      for (const file of restored.files) {
        fs.write(file.path, file.content, file.language);
      }
      if (restored.files.length > 0) {
        openGeneratedFile(restored.files[0].path);
      }

      setMessages(session.messages);
      setConversationPhase(getLatestConversationPhase(session.messages));
      setMode('chat');
      document.body.classList.remove('on-landing');
      if (pushHistory) {
        nav.pushSession(sessionId);
      }
    }
  }, [sessions, clearWorkspace, resolveArtifactContent, a2ui, fs, openGeneratedFile, nav.pushSession, setConversationPhase]);

  // Wire up popstate -> handler dispatch (updated every render via ref)
  navHandlerRef.current = (state: NavState) => {
    if (state.view === 'landing') {
      handleNewSession(false);
    } else if (state.view === 'session' && state.sessionId) {
      handleResumeSession(state.sessionId, false);
    }
  };

  // On mount, restore session from URL if deep-linked
  useEffect(() => {
    const initial = nav.getInitialState();
    if (initial.view === 'session' && initial.sessionId) {
      const session = sessions.sessions.find(s => s.id === initial.sessionId);
      if (session) {
        handleResumeSession(initial.sessionId, false);
      } else {
        nav.replaceCurrent({ view: 'landing' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isStreaming = mockEnabled ? mockStreaming.isStreaming : streaming.isStreaming;
  const currentStreamText = mockEnabled ? mockStreaming.streamText : streaming.streamText;
  const usageSummary = useMemo(() => summarizeTokenUsage(messages), [messages]);
  const fsFiles = useSyncExternalStore(fs.subscribe, fs.getSnapshot);
  const hasFiles = fsFiles.length > 0 || vfsFiles.length > 0;
  const activeSession = sessions.getActiveSession();
  const getDeploymentFiles = useCallback(async () => {
    const liveFiles = fs.list();
    if (liveFiles.length > 0) {
      return liveFiles.map((file) => ({
        path: file.path,
        content: file.content,
        language: file.language,
      }));
    }

    const persistedFiles = await vfs.readAll();
    return persistedFiles.map((file) => ({
      path: file.path,
      content: file.content,
      language: file.language,
    }));
  }, [fs, vfs]);

  const sessionContextValue = useMemo(() => ({
    localSessionId: sessions.activeSessionId,
    backendSessionId: activeSession?.backendSessionId ?? null,
    currentPhase,
    activeSession,
    getDeploymentFiles,
  }), [activeSession, currentPhase, getDeploymentFiles, sessions.activeSessionId]);

  // Auto-show file panel and sidebar when files appear
  const hadFilesRef = useRef(false);
  useEffect(() => {
    if (hasFiles && !hadFilesRef.current) {
      setFilePanelOpen(true);
      setFileSidebarOpen(true);
    }
    hadFilesRef.current = hasFiles;
  }, [hasFiles]);

  const handleToggleFilePanel = useCallback(() => {
    setFilePanelOpen((prev) => !prev);
    setFileSidebarOpen((prev) => !prev);
  }, []);

  // --- File Manager sidebar / viewer handlers ---
  const handleSelectViewerFile = useCallback((path: string) => {
    openGeneratedFile(path);
  }, [openGeneratedFile]);

  const handleDownloadZip = useCallback(async () => {
    try {
      const blob = await vfs.exportZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kickstart-files.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[FileManager] ZIP export failed:', err);
    }
  }, [vfs]);

  const handleDeleteViewerFile = useCallback(async (path: string) => {
    try {
      await vfs.deleteFile(path);
    } catch {
      // file may not exist in IndexedDB
    }
    fs.delete(path);
    if (viewerFile === path) {
      viewerFileRef.current = undefined;
      setViewerFile(undefined);
    }
    if (selectedFile === path) {
      selectedFileRef.current = undefined;
      setSelectedFile(undefined);
    }
  }, [vfs, fs, viewerFile, selectedFile]);

  const handleDismissSidebar = useCallback(() => {
    setFileSidebarOpen(false);
  }, []);

  const handleDismissViewer = useCallback(() => {
    viewerFileRef.current = undefined;
    setViewerFile(undefined);
  }, []);

  // Playground mode — standalone A2UI test harness
  if (playgroundEnabled) {
    return (
      <FluentProvider theme={fluentTheme}>
        <ConversationSessionProvider value={sessionContextValue}>
          <Layout
            sidebarOpen={false}
            onToggleSidebar={() => {}}
            onNewSession={() => {}}
            showSessionsToggle={false}
            hasFiles={false}
          >
            <Playground />
          </Layout>
        </ConversationSessionProvider>
      </FluentProvider>
    );
  }

  return (
    <FluentProvider theme={fluentTheme}>
      <ConversationSessionProvider value={sessionContextValue}>
        <Layout
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          onNewSession={handleNewSession}
          showSessionsToggle={mode === 'chat'}
          hasFiles={hasFiles && filePanelOpen}
          showFilePanel={mode === 'chat' && filePanelOpen}
          showFileSidebar={mode === 'chat' && fileSidebarOpen && hasFiles}
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
          fileEditor={mode === 'chat' ? (
            <>
              <FileEditor
                fs={fs}
                selectedPath={selectedFile}
                onSelectFile={openGeneratedFile}
              />
              <FileTreePanel />
            </>
          ) : undefined}
          fileManagerSidebar={mode === 'chat' ? (
            <FileManagerSidebar
              streamingFiles={fsFiles}
              persistedFiles={vfsFileRecords}
              selectedPath={viewerFile}
              onSelectFile={handleSelectViewerFile}
              onDownloadZip={handleDownloadZip}
              onDismiss={handleDismissSidebar}
            />
          ) : undefined}
          fileViewer={mode === 'chat' ? (
            <FileViewer
              filePath={viewerFile}
              streamingFiles={fsFiles}
              vfs={vfs}
              onDeleteFile={handleDeleteViewerFile}
              onDismiss={handleDismissViewer}
            />
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
              usageSummary={usageSummary}
            />
          )}
        </Layout>
      </ConversationSessionProvider>
    </FluentProvider>
  );
}
