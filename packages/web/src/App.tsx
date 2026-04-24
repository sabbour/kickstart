import React, { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore, lazy, Suspense } from 'react';
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { Layout } from './components/Layout';
import { Landing } from './components/Landing';
import { ChatShell } from './components/Chat/ChatShell';
import { SessionsSidebar } from './components/Sidebar/SessionsSidebar';
import { FileManagerSidebar, FileViewer } from './components/FileManager';
const Playground = lazy(() => import('./pages/Playground').then((m) => ({ default: m.Playground })));
import { useA2UI } from './hooks/useA2UI';
import { useActionDispatch } from './hooks/useActionDispatch';
import { useProgressiveQueue } from './hooks/useProgressiveQueue';
import { useSessions } from './hooks/useSessions';
import { useNavigation } from './hooks/useNavigation';
import type { NavState } from './hooks/useNavigation';
import { useStreaming } from './hooks/useStreaming';
import type { A2uiEventMetadata } from './hooks/useStreaming';
// TODO(Step 5): useMockStreaming removed — mock mode deleted in Step 1
import { useAPIConnectorRegistry } from './contexts/APIConnectorContext';
import { useArtifacts } from './contexts/ArtifactContext';
import { ConversationSessionProvider } from './contexts/ConversationSessionContext';
import { useTheme } from './contexts/ThemeContext';
import { useDebug } from './contexts/DebugContext';
import { useVirtualFS } from './contexts/VirtualFSContext';
import { healthCheck, type HealthCheckResult } from './services/api-client';
// TODO(Step 5): mock-streaming removed — mock mode deleted in Step 1
// isMockMode and isPlaygroundMode permanently return false
import { VirtualFileSystem } from './services/virtual-fs';
import {
  applyStepwiseSetupEvent,
  buildStepwiseSetupMessages,
  createStepwiseSetupState,
  getLatestConversationPhase,
  getSetupEventKey,
  getStepwiseSetupSurfaceId,
  normalizeConversationPhase,
  prepareChatA2ui,
  redactSetupEvent,
  rebuildChatSessionState,
} from './utils/chat-a2ui';
import { summarizeTokenUsage } from './utils/chat-usage';
import { normalizePath as validateAndNormalizePath } from './utils/path-validation';
import type { AppMode, ChatMessage, A2uiPayloadItem, ConversationPhaseId, SetupGenerationEvent } from './types';
// A2uiClientAction type no longer needed — actions route through useActionDispatch only

const mockEnabled = false; // TODO(Step 5): mock mode deleted in Step 1

export function getInitialAppMode(locationSearch?: string): AppMode {
  const search = locationSearch ?? (typeof window !== 'undefined' ? window.location.search : '');
  return new URLSearchParams(search).has('playground') ? 'playground' : 'landing';
}

let msgSeq = 0;
function msgId(role: string) {
  return `msg-${Date.now()}-${++msgSeq}-${role}`;
}

function normalizeMessageSurfaceAttachments(messages: ChatMessage[]): {
  messages: ChatMessage[];
  surfaceOwners: Map<string, string>;
} {
  const surfaceOwners = new Map<string, string>();
  let changed = false;

  const normalizedMessages = messages.map((message) => {
    if (message.role !== 'assistant' || !message.surfaceIds?.length) {
      return message;
    }

    const keptIds: string[] = [];
    const seenInMessage = new Set<string>();

    for (const surfaceId of message.surfaceIds) {
      if (seenInMessage.has(surfaceId)) {
        changed = true;
        continue;
      }
      seenInMessage.add(surfaceId);

      if (!surfaceOwners.has(surfaceId)) {
        surfaceOwners.set(surfaceId, message.id);
        keptIds.push(surfaceId);
        continue;
      }

      changed = true;
    }

    if (keptIds.length === message.surfaceIds.length) {
      return message;
    }

    return {
      ...message,
      surfaceIds: keptIds.length > 0 ? keptIds : undefined,
    };
  });

  return {
    messages: changed ? normalizedMessages : messages,
    surfaceOwners,
  };
}

export function App() {
  const { resolvedTheme } = useTheme();
  const { debugEnabled, logAction, clearActionLog } = useDebug();
  const fluentTheme = resolvedTheme === 'dark' ? webDarkTheme : webLightTheme;

  const [mode, setMode] = useState<AppMode>(() => getInitialAppMode());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [healthCheckResult, setHealthCheckResult] = useState<HealthCheckResult | null>(mockEnabled ? { ok: true } : null);
  const [filePanelOpen, setFilePanelOpen] = useState(true);
  const [fileSidebarOpen, setFileSidebarOpen] = useState(true);
  const [viewerFile, setViewerFile] = useState<string | undefined>();
  const viewerFileRef = useRef<string | undefined>(undefined);
  const [stepwiseStreamingText, setStepwiseStreamingText] = useState('');
  const [stepwiseStreamingActive, setStepwiseStreamingActive] = useState(false);

  const connectorRegistry = useAPIConnectorRegistry();
  const { getArtifact } = useArtifacts();

  const { handler: actionHandler, resetConsecutiveCount } = useActionDispatch({
    onSendMessage: (msg, event) => handleSendMessage(msg, false, undefined, event),
    onAutoContinue: (msg, event) => handleSendMessage(msg, true, undefined, event),
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
  // TODO(Step 5): mockStreaming removed — use real streaming only
  const mockStreaming: {
    isStreaming: boolean;
    streamText: string;
    send: (text: string, sessionId: string | undefined, callbacks: {
      onChunk?: (t: string) => void;
      onA2UI?: (payload: A2uiPayloadItem[]) => void;
      onSetupEvent?: (event: SetupGenerationEvent) => void;
      onPhase?: (phase: string) => void;
      onComplete?: (fullText: string, model?: string) => void;
      onError?: (error: string) => void;
    }) => void;
  } = { isStreaming: false, streamText: '', send: () => {} };
  const progressiveQueue = useProgressiveQueue();

  // Single VFS instance for the app lifetime
  const fs = useMemo(() => new VirtualFileSystem(), []);

  // IndexedDB-backed persistent filesystem (provided via context)
  const { fs: vfs, files: vfsFiles, fileRecords: vfsFileRecords } = useVirtualFS();
  const workspaceSnapshotSyncSuspendedRef = useRef(false);

  // Navigation: ref breaks circular dependency between nav callbacks and handlers
  const navHandlerRef = useRef<(state: NavState) => void>(() => {});
  const nav = useNavigation((state) => navHandlerRef.current(state));

  // Sync in-memory VFS → IndexedDB when files complete (with deduplication)
  const lastPersistedRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const unsub = fs.subscribe(() => {
      if (workspaceSnapshotSyncSuspendedRef.current) {
        return;
      }

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

      if (sessions.activeSessionId) {
        const completeFiles = snapshot
          .filter((file) => file.status === 'complete')
          .map((file) => ({
            path: file.path,
            content: file.content,
            language: file.language,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
          }));

        vfs.saveWorkspaceSnapshot(sessions.activeSessionId, completeFiles).catch((err) => {
          console.error('[Workspace] failed to save session snapshot:', err);
        });
      }
    });
    return unsub;
  }, [fs, sessions.activeSessionId, vfs]);

  // Messages for the active session
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Current conversation phase from SSE events
  const [currentPhase, setCurrentPhase] = useState<ConversationPhaseId | null>(null);
  const currentPhaseRef = useRef<ConversationPhaseId | null>(null);

  // Surface IDs revealed progressively via the queue
  const streamingSurfaceIdsRef = useRef<string[]>([]);
  const surfaceOwnersRef = useRef<Map<string, string>>(new Map());

  // Raw A2UI messages accumulated during streaming (for session persistence)
  const streamingA2UIMessagesRef = useRef<A2uiPayloadItem[]>([]);
  const streamingSetupEventsRef = useRef<SetupGenerationEvent[]>([]);
  const streamingSetupStateRef = useRef(createStepwiseSetupState());
  const streamingSetupEventKeysRef = useRef<Set<string>>(new Set());
  const streamingSetupSurfaceCreatedRef = useRef(false);
  const streamingSetupPersistedRef = useRef(false);

  useEffect(() => {
    viewerFileRef.current = viewerFile;
  }, [viewerFile]);

  // Check API availability on mount (skip in mock mode — already true)
  useEffect(() => {
    if (!mockEnabled) {
      healthCheck().then(setHealthCheckResult);
    }
  }, []);

  // Sync messages from session store when session changes
  useEffect(() => {
    const active = sessions.getActiveSession();
    if (active) {
      const normalized = normalizeMessageSurfaceAttachments(active.messages);
      surfaceOwnersRef.current = normalized.surfaceOwners;
      setMessages(normalized.messages);
      const phase = getLatestConversationPhase(active.messages);
      setCurrentPhase(phase);
      currentPhaseRef.current = phase;
    } else {
      setMessages([]);
      setCurrentPhase(null);
      currentPhaseRef.current = null;
      surfaceOwnersRef.current = new Map();
    }
  }, [sessions.activeSessionId]);

  const setConversationPhase = useCallback((phase: string | null | undefined) => {
    const normalized = normalizeConversationPhase(phase);
    setCurrentPhase(normalized);
    currentPhaseRef.current = normalized;
  }, []);

  const openGeneratedFile = useCallback((path: string) => {
    setFilePanelOpen(true);
    viewerFileRef.current = path;
    setViewerFile(path);
  }, []);

  const resolveArtifactContent = useCallback((artifactPath: string) => {
    return getArtifact(artifactPath)?.content ?? null;
  }, [getArtifact]);

  const resetStepwiseStreamingState = useCallback(() => {
    setStepwiseStreamingActive(false);
    setStepwiseStreamingText('');
    streamingSetupEventsRef.current = [];
    streamingSetupStateRef.current = createStepwiseSetupState();
    streamingSetupEventKeysRef.current = new Set();
    streamingSetupSurfaceCreatedRef.current = false;
    streamingSetupPersistedRef.current = false;
  }, []);

  const clearWorkspace = useCallback(async () => {
    workspaceSnapshotSyncSuspendedRef.current = true;
    a2ui.reset();
    surfaceOwnersRef.current = new Map();
    fs.clear();
    lastPersistedRef.current = new Map();
    clearActionLog();
    viewerFileRef.current = undefined;
    setViewerFile(undefined);
    resetStepwiseStreamingState();
    setConversationPhase(null);
    try {
      await vfs.clear();
    } catch (err) {
      console.error('[Workspace] failed to clear persisted files:', err);
    } finally {
      workspaceSnapshotSyncSuspendedRef.current = false;
    }
  }, [a2ui, clearActionLog, fs, resetStepwiseStreamingState, setConversationPhase, vfs]);

  const claimSurfaceIdsForAssistantMessage = useCallback((
    assistantMessageId: string,
    candidateIds: string[],
  ): string[] => {
    const trackedIds = new Set(streamingSurfaceIdsRef.current);
    const ownedIds: string[] = [];

    for (const surfaceId of candidateIds) {
      if (!a2ui.getSurface(surfaceId)) {
        continue;
      }

      const owner = surfaceOwnersRef.current.get(surfaceId);
      if (!owner) {
        surfaceOwnersRef.current.set(surfaceId, assistantMessageId);
      } else if (owner !== assistantMessageId) {
        continue;
      }

      if (!trackedIds.has(surfaceId)) {
        trackedIds.add(surfaceId);
        ownedIds.push(surfaceId);
      }
    }

    return ownedIds;
  }, [a2ui]);

  const persistStepwiseStreamingMessage = useCallback((
    sessionId: string,
    assistantMessageId: string,
    text: string,
  ) => {
    const surfaceIds = streamingSurfaceIdsRef.current.length > 0
      ? [...streamingSurfaceIdsRef.current]
      : [getStepwiseSetupSurfaceId(assistantMessageId)];
    const draftMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      text,
      surfaceIds,
      phase: 'generate',
      timestamp: Date.now(),
      setupEvents: [...streamingSetupEventsRef.current],
    };

    if (streamingSetupPersistedRef.current) {
      sessions.updateMessage(sessionId, assistantMessageId, draftMessage);
      return;
    }

    sessions.addMessage(sessionId, draftMessage);
    streamingSetupPersistedRef.current = true;
  }, [sessions]);

  const processIncomingSetupEvent = useCallback((
    event: SetupGenerationEvent,
    assistantMessageId: string,
    sessionId: string,
  ) => {
    const eventKey = getSetupEventKey(event);
    if (streamingSetupEventKeysRef.current.has(eventKey)) {
      return;
    }
    streamingSetupEventKeysRef.current.add(eventKey);

    setStepwiseStreamingActive(true);
    setConversationPhase('generate');

    if (event.type === 'file_generated' && typeof event.content === 'string') {
      fs.write(event.path, event.content, event.language);
      if (!viewerFileRef.current) {
        openGeneratedFile(event.path);
      }
    }

    const persistedEvent = redactSetupEvent(event);
    streamingSetupEventsRef.current = [
      ...streamingSetupEventsRef.current,
      persistedEvent,
    ];
    streamingSetupStateRef.current = applyStepwiseSetupEvent(
      streamingSetupStateRef.current,
      persistedEvent,
    );

    const statusText = streamingSetupStateRef.current.statusText;
    setStepwiseStreamingText(statusText);

    const renderableMessages = buildStepwiseSetupMessages(
      streamingSetupStateRef.current,
      assistantMessageId,
      {
        includeCreateSurface: !streamingSetupSurfaceCreatedRef.current,
        final: false,
      },
    );
    if (renderableMessages.length > 0) {
      const newIds = a2ui.processMessages(renderableMessages);
      if (renderableMessages.some((message) => Boolean(message.createSurface))) {
        streamingSetupSurfaceCreatedRef.current = true;
      }
      const ownedIds = claimSurfaceIdsForAssistantMessage(assistantMessageId, newIds);
      if (ownedIds.length > 0) {
        streamingSurfaceIdsRef.current = [...streamingSurfaceIdsRef.current, ...ownedIds];
        progressiveQueue.enqueue(ownedIds);
      }
    }

    persistStepwiseStreamingMessage(sessionId, assistantMessageId, statusText);
  }, [
    a2ui,
    claimSurfaceIdsForAssistantMessage,
    fs,
    openGeneratedFile,
    persistStepwiseStreamingMessage,
    progressiveQueue,
    setConversationPhase,
  ]);

  const finalizeStepwiseAssistantTurn = useCallback((params: {
    assistantMessageId: string;
    sessionId: string;
    debugInfo?: ChatMessage['debugInfo'];
    errorMessage?: string;
    model?: string;
    usage?: ChatMessage['usage'];
  }): boolean => {
    if (streamingSetupEventsRef.current.length === 0) {
      return false;
    }

    if (params.errorMessage) {
      const lastKnownStep = streamingSetupStateRef.current.steps[streamingSetupStateRef.current.steps.length - 1];
      const activeStepId = streamingSetupStateRef.current.steps.find((step) => step.status === 'running')?.id
        ?? lastKnownStep?.id
        ?? 'deployment-config';

      processIncomingSetupEvent({
        type: 'step_error',
        stepId: activeStepId,
        code: 'connection_interrupted',
        message: params.errorMessage,
        recoverable: true,
      }, params.assistantMessageId, params.sessionId);
    }

    progressiveQueue.flush();
    const renderableMessages = buildStepwiseSetupMessages(
      streamingSetupStateRef.current,
      params.assistantMessageId,
      {
        includeCreateSurface: !streamingSetupSurfaceCreatedRef.current,
        final: true,
      },
    );
    if (renderableMessages.length > 0) {
      const newIds = a2ui.processMessages(renderableMessages);
      if (renderableMessages.some((message) => Boolean(message.createSurface))) {
        streamingSetupSurfaceCreatedRef.current = true;
      }
      const ownedIds = claimSurfaceIdsForAssistantMessage(params.assistantMessageId, newIds);
      if (ownedIds.length > 0) {
        streamingSurfaceIdsRef.current = [...streamingSurfaceIdsRef.current, ...ownedIds];
        progressiveQueue.enqueue(ownedIds);
      }
    }

    const surfaceIds = streamingSurfaceIdsRef.current.length > 0
      ? [...streamingSurfaceIdsRef.current]
      : [getStepwiseSetupSurfaceId(params.assistantMessageId)];
    const finalText = streamingSetupStateRef.current.errorMessage
      ? streamingSetupStateRef.current.statusText
      : 'Project setup complete. Generated files are ready in the workspace.';

    const assistantMsg: ChatMessage = {
      id: params.assistantMessageId,
      role: 'assistant',
      text: finalText,
      ...(params.model ? { model: params.model } : {}),
      surfaceIds,
      phase: 'generate',
      timestamp: Date.now(),
      ...(params.debugInfo ? { debugInfo: params.debugInfo } : {}),
      ...(streamingA2UIMessagesRef.current.length > 0 ? { a2uiMessages: [...streamingA2UIMessagesRef.current] } : {}),
      setupEvents: [...streamingSetupEventsRef.current],
      ...(params.usage ? { usage: params.usage } : {}),
    };

    setMessages(prev => [...prev, assistantMsg]);
    if (streamingSetupPersistedRef.current) {
      sessions.updateMessage(params.sessionId, params.assistantMessageId, assistantMsg);
    } else {
      sessions.addMessage(params.sessionId, assistantMsg);
    }

    resetStepwiseStreamingState();
    return true;
  }, [
    a2ui,
    claimSurfaceIdsForAssistantMessage,
    processIncomingSetupEvent,
    progressiveQueue,
    resetStepwiseStreamingState,
    sessions,
  ]);

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

    if (prepared.files.length > 0 && !viewerFileRef.current) {
      openGeneratedFile(prepared.files[0].path);
    }

    const newIds = a2ui.processMessages(prepared.renderableMessages);
    const ownedIds = claimSurfaceIdsForAssistantMessage(turnId, newIds);
    if (ownedIds.length > 0) {
      streamingSurfaceIdsRef.current = [...streamingSurfaceIdsRef.current, ...ownedIds];
      progressiveQueue.enqueue(ownedIds);
    }
  }, [resolveArtifactContent, fs, openGeneratedFile, a2ui, claimSurfaceIdsForAssistantMessage, progressiveQueue, setConversationPhase]);

  // Per Zapp: treat write_file SSE payloads as untrusted — normalize paths,
  // reject traversal/absolute, cap file size before writing to VFS.
  const MAX_WRITE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const handleWriteFile = useCallback((file: { path: string; content: string }) => {
    const safePath = validateAndNormalizePath(file.path);
    if (!safePath) {
      console.warn('[write_file] Rejected invalid path:', file.path);
      return;
    }
    const byteLength = new TextEncoder().encode(file.content).byteLength;
    if (byteLength > MAX_WRITE_FILE_SIZE) {
      console.warn('[write_file] Rejected oversized file:', safePath, byteLength);
      return;
    }
    fs.write(safePath, file.content);
    if (!viewerFileRef.current) {
      openGeneratedFile(safePath);
    }
  }, [fs, openGeneratedFile]);

  const handleSendMessage = useCallback(async (text: string, isAutoContinue = false, explicitSessionId?: string, event?: A2uiEventMetadata) => {
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

    if (!healthCheckResult?.ok) {
      // Build specific error message based on health check phase
      let errorText = '⚠️ The API is not available. ';
      
      if (healthCheckResult?.error) {
        const { phase, message, hint } = healthCheckResult.error;
        
        if (phase === 'env-validation') {
          errorText += 'Azure OpenAI credentials are not configured. ' + (hint || '');
        } else if (phase === 'pack-import') {
          errorText += 'Pack initialization failed. ' + (hint || '');
        } else if (phase === 'api-timeout') {
          errorText += 'API is responding slowly. ' + (hint || '');
        } else if (phase === 'api-unreachable') {
          errorText += (hint || 'Check that the API server is running.');
        } else {
          errorText += message + (hint ? ' ' + hint : '');
        }
      } else {
        errorText += 'Please check that Azure OpenAI credentials are configured and the API is running.';
      }
      
      const errorMsg: ChatMessage = {
        id: msgId('error'),
        role: 'assistant',
        text: errorText,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
      sessions.addMessage(sessionId!, errorMsg);
      return;
    }

    // Reset streaming surface IDs for the new turn
    streamingSurfaceIdsRef.current = [];
    streamingA2UIMessagesRef.current = [];
    resetStepwiseStreamingState();
    progressiveQueue.reset();

    const handleIncomingA2UI = (payload: A2uiPayloadItem[]) => {
      processIncomingA2UI(payload, assistantMessageId);
    };
    const handleIncomingSetupEvent = (event: SetupGenerationEvent) => {
      processIncomingSetupEvent(event, assistantMessageId, sessionId!);
    };

    // Use mock streaming when ?mock is active, real streaming otherwise
    if (mockEnabled) {
      mockStreaming.send(text, sessionId, {
        onChunk: () => {},
        onA2UI: handleIncomingA2UI,
        onSetupEvent: handleIncomingSetupEvent,
        onPhase: (phase) => setConversationPhase(phase),
        onComplete: (fullText, model) => {
          if (finalizeStepwiseAssistantTurn({
            assistantMessageId,
            sessionId: sessionId!,
            model,
          })) {
            streamingSurfaceIdsRef.current = [];
            streamingA2UIMessagesRef.current = [];
            progressiveQueue.reset();
            return;
          }

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
          if (finalizeStepwiseAssistantTurn({
            assistantMessageId,
            sessionId: sessionId!,
            errorMessage: error,
          })) {
            streamingSurfaceIdsRef.current = [];
            streamingA2UIMessagesRef.current = [];
            progressiveQueue.reset();
            return;
          }

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
        onChunk: () => {},
        onA2UI: handleIncomingA2UI,
        onSetupEvent: handleIncomingSetupEvent,
        onPhase: (phase) => setConversationPhase(phase),
        onWriteFile: handleWriteFile,
        onComplete: (fullText, model, receivedSessionId, debugInfo, usage) => {
          const phase = currentPhaseRef.current || undefined;
          // Store the backend session ID on first response
          if (receivedSessionId && !activeSession?.backendSessionId) {
            sessions.updateSession(sessionId!, { backendSessionId: receivedSessionId });
          }

          if (finalizeStepwiseAssistantTurn({
            assistantMessageId,
            sessionId: sessionId!,
            debugInfo,
            model,
            usage: usage?.turn,
          })) {
            streamingSurfaceIdsRef.current = [];
            streamingA2UIMessagesRef.current = [];
            progressiveQueue.reset();
            return;
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
          if (finalizeStepwiseAssistantTurn({
            assistantMessageId,
            sessionId: sessionId!,
            errorMessage: error,
          })) {
            streamingSurfaceIdsRef.current = [];
            streamingA2UIMessagesRef.current = [];
            progressiveQueue.reset();
            return;
          }

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
      }, debugEnabled, activeSession?.messages ?? [], event);
    }
  }, [
    clearActionLog,
    debugEnabled,
    finalizeStepwiseAssistantTurn,
    handleWriteFile,
    healthCheckResult,
    mockStreaming,
    processIncomingA2UI,
    processIncomingSetupEvent,
    progressiveQueue,
    resetConsecutiveCount,
    resetStepwiseStreamingState,
    sessions,
    setConversationPhase,
    streaming,
  ]);

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
    await vfs.clearWorkspaceSnapshots().catch((err) => {
      console.error('[Workspace] failed to clear saved session snapshots:', err);
    });
    await clearWorkspace();
  }, [clearWorkspace, sessions, vfs]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    sessions.deleteSession(sessionId);
    void vfs.deleteWorkspaceSnapshot(sessionId).catch((err) => {
      console.error('[Workspace] failed to delete session snapshot:', err);
    });
  }, [sessions, vfs]);

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
      const workspaceSnapshot = await vfs.loadWorkspaceSnapshot(sessionId).catch((err) => {
        console.error('[Workspace] failed to restore session snapshot:', err);
        return [];
      });
      const restored = rebuildChatSessionState(session.messages, {
        resolveArtifactContent,
      });

      if (restored.renderableMessages.length > 0) {
        a2ui.processMessages(restored.renderableMessages);
      }

      const filesToRestore = workspaceSnapshot.length > 0 ? workspaceSnapshot : restored.files;
      workspaceSnapshotSyncSuspendedRef.current = true;
      try {
        for (const file of filesToRestore) {
          fs.write(file.path, file.content, file.language);
        }

        const restoredWorkspaceFiles = fs.getSnapshot()
          .filter((file) => file.status === 'complete')
          .map((file) => ({
            path: file.path,
            content: file.content,
            language: file.language,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
          }));
        lastPersistedRef.current = new Map(
          restoredWorkspaceFiles.map((file) => [file.path, file.content]),
        );

        await Promise.all(
          restoredWorkspaceFiles.map((file) => vfs.writeFile(file.path, file.content, file.language)),
        );
        await vfs.saveWorkspaceSnapshot(sessionId, restoredWorkspaceFiles);
      } finally {
        workspaceSnapshotSyncSuspendedRef.current = false;
      }

      if (filesToRestore.length > 0) {
        openGeneratedFile(filesToRestore[0].path);
      }

      const normalized = normalizeMessageSurfaceAttachments(session.messages);
      surfaceOwnersRef.current = normalized.surfaceOwners;
      setMessages(normalized.messages);
      setConversationPhase(getLatestConversationPhase(session.messages));
      setMode('chat');
      document.body.classList.remove('on-landing');
      if (pushHistory) {
        nav.pushSession(sessionId);
      }
    }
  }, [a2ui, clearWorkspace, fs, nav.pushSession, openGeneratedFile, resolveArtifactContent, sessions, setConversationPhase, vfs]);

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
  }, []);

  const isStreaming = mockEnabled ? mockStreaming.isStreaming : streaming.isStreaming;
  const baseStreamText = mockEnabled ? mockStreaming.streamText : streaming.streamText;
  const currentStreamText = stepwiseStreamingActive ? stepwiseStreamingText : baseStreamText;
  const usageSummary = useMemo(() => summarizeTokenUsage(messages), [messages]);
  const fsFiles = useSyncExternalStore(fs.subscribe, fs.getSnapshot, fs.getSnapshot);
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
    if (!filePanelOpen && hasFiles) {
      setFileSidebarOpen(true);
    }
    setFilePanelOpen((prev) => !prev);
  }, [filePanelOpen, hasFiles]);

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
      if (!fileSidebarOpen) {
        setFilePanelOpen(false);
      }
    }
  }, [vfs, fs, viewerFile, fileSidebarOpen]);

  const handleDismissSidebar = useCallback(() => {
    setFileSidebarOpen(false);
    if (!viewerFileRef.current) {
      setFilePanelOpen(false);
    }
  }, []);

  const handleDismissViewer = useCallback(() => {
    viewerFileRef.current = undefined;
    setViewerFile(undefined);
    if (!fileSidebarOpen) {
      setFilePanelOpen(false);
    }
  }, [fileSidebarOpen]);

  // Playground mode — standalone A2UI test harness
  if (mode === 'playground') {
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
            <Suspense fallback={null}><Playground /></Suspense>
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
          showFileSidebar={mode === 'chat' && filePanelOpen && fileSidebarOpen && hasFiles}
          showFileViewer={mode === 'chat' && filePanelOpen && !!viewerFile}
          onToggleFilePanel={mode === 'chat' && hasFiles ? handleToggleFilePanel : undefined}
          sidebar={mode === 'chat' ? (
            <SessionsSidebar
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              sessions={sessions.sessions}
              activeSessionId={sessions.activeSessionId}
              onSelectSession={handleResumeSession}
              onNewSession={handleNewSession}
              onDeleteSession={handleDeleteSession}
            />
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
              onDeleteSession={handleDeleteSession}
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
