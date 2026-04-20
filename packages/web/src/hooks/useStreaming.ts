import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  A2uiPayloadItem,
  DebugMetadata,
  ChatMessage,
  SetupGenerationEvent,
  TokenUsageSummary,
  TurnUsage,
} from '../types';
import { apiFetch, SessionExpiredError } from '../services/api-client';
import { normalizeConversationPhase } from '../utils/chat-a2ui';
import type { AppIntent } from '@aks-kickstart/harness';

// ---------------------------------------------------------------------------
// A2UI item type guard (validate before passing to renderer)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRawA2uiItem(item: unknown): item is A2uiPayloadItem {
  return isRecord(item) && (item['version'] === 'v0.9' || item['type'] === 'ConversationPhase');
}

// ---------------------------------------------------------------------------
// UserAction request payload
// ---------------------------------------------------------------------------

export interface UserActionReqPayload {
  sessionId: string;
  actionId: string;
  toolName: string;
  wireName: string;
  parameters: unknown;
  confirmComponent?: { component: string; props?: Record<string, unknown> };
  scopes: string[];
  /** Cancellation policy declared by the UserAction. Default: 'not-supported' (queue). */
  cancellation?: 'supported' | 'not-supported';
}

// ---------------------------------------------------------------------------
// Stream callbacks
// ---------------------------------------------------------------------------

export interface StreamCallbacks {
  /** Accumulated text from all chunk events (passed on each chunk and at completion). */
  onChunk: (text: string) => void;
  /** A2UI protocol messages validated by type guard before dispatch. */
  onA2UI: (messages: A2uiPayloadItem[]) => void;
  /** Stepwise generation events (v1 compat, may not fire in v2). */
  onSetupEvent: (event: SetupGenerationEvent) => void;
  /** Phase transition announced via v1 phase event. */
  onPhase: (phase: string) => void;
  /**
   * Turn complete.
   * @param fullText - Accumulated text from all chunk events.
   * @param model - Model name, if reported.
   * @param sessionId - Session ID from the end event.
   * @param debugInfo - Debug metadata when debug mode is active.
   * @param usage - Token usage summary if available.
   */
  onComplete: (
    fullText: string,
    model?: string,
    sessionId?: string,
    debugInfo?: DebugMetadata,
    usage?: TokenUsageSummary,
  ) => void;
  onError: (error: string) => void;
  /**
   * v2: fired when the server emits a `user_action_req` event.
   * The hook pauses — caller should dispatch to /api/converse/resume via useActionDispatch.
   */
  onUserActionReq?: (payload: UserActionReqPayload) => void;
  /**
   * v2: fired when the `end` event carries an intent field.
   * Used by useNavigation to trigger onIntent routing without direct phase leakage.
   * TODO(Step N, #480): Full intent→navigation wiring will land when skill resolver ships.
   */
  onIntent?: (intent: AppIntent) => void;
}

// Target ~80 rAF frames to reveal all text (~1.3s at 60fps)
const REVEAL_FRAMES = 80;

// ---------------------------------------------------------------------------
// SDK 406 non-streaming fallback
// ---------------------------------------------------------------------------

export interface SdkNonStreamingFetchParams {
  sessionId: string | undefined;
  message: string;
  clientMessages: Array<{ role: 'user' | 'assistant'; content: string; phase?: string; usage?: TurnUsage }> | undefined;
  signal: AbortSignal;
  debugMode: boolean;
}

export interface SdkNonStreamingFetchResult {
  text: string;
  model?: string;
  sessionId?: string;
}

/**
 * Non-streaming fallback used when the server responds 406 to an
 * `Accept: text/event-stream` request, or when streaming is otherwise
 * unavailable. Exported so it can be exercised without a React rendering
 * context; not intended as a public hook API.
 *
 * Contract: HTTP 406 on streaming request → retry as JSON, surface any phase /
 * a2ui the server produced, and return the final text/model/session.
 */
export async function _performSdkNonStreamingFetch(
  params: SdkNonStreamingFetchParams,
  callbacks: Pick<StreamCallbacks, 'onPhase' | 'onA2UI'>,
  debugA2uiMessages: A2uiPayloadItem[],
  fetchFn: typeof apiFetch = apiFetch,
): Promise<SdkNonStreamingFetchResult> {
  const { sessionId, message, clientMessages, signal, debugMode } = params;

  const res = await fetchFn('/api/converse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      message,
      stream: false,
      ...(clientMessages?.length ? { messages: clientMessages } : {}),
    }),
    signal,
  }, debugMode);

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const body = (await res.json()) as Record<string, unknown>;

  if (typeof body.phase === 'string') {
    const normalized = normalizeConversationPhase(body.phase);
    if (normalized) callbacks.onPhase(normalized);
  }

  if (Array.isArray(body.a2ui)) {
    const safeItems = (body.a2ui as unknown[]).filter(isRawA2uiItem);
    if (safeItems.length > 0) {
      if (debugMode) debugA2uiMessages.push(...safeItems);
      callbacks.onA2UI(safeItems);
    }
  }

  return {
    text: typeof body.message === 'string' ? body.message : '',
    model: typeof body.model === 'string' ? body.model : undefined,
    sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
  };
}

export function useStreaming() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Progressive text reveal
  const targetTextRef = useRef('');
  const revealedLenRef = useRef(0);
  const rafRef = useRef(0);
  const charsPerFrameRef = useRef(2);
  const revealDoneRef = useRef<(() => void) | null>(null);

  const startRevealLoop = useCallback(() => {
    if (rafRef.current) return;
    const tick = () => {
      const target = targetTextRef.current;
      const idx = revealedLenRef.current;
      if (idx >= target.length) {
        rafRef.current = 0;
        const cb = revealDoneRef.current;
        revealDoneRef.current = null;
        cb?.();
        return;
      }
      const next = Math.min(idx + charsPerFrameRef.current, target.length);
      revealedLenRef.current = next;
      setStreamText(target.slice(0, next));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const cancelReveal = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const cb = revealDoneRef.current;
    revealDoneRef.current = null;
    cb?.();
  }, []);

  const updateRevealTarget = useCallback((text: string) => {
    targetTextRef.current = text;
    const remaining = text.length - revealedLenRef.current;
    charsPerFrameRef.current = Math.max(2, Math.ceil(remaining / REVEAL_FRAMES));
    startRevealLoop();
  }, [startRevealLoop]);

  const send = useCallback(async (
    message: string,
    sessionId: string | undefined,
    callbacks: StreamCallbacks,
    debugMode?: boolean,
    chatHistory?: ChatMessage[],
  ) => {
    setIsStreaming(true);
    setStreamText('');
    targetTextRef.current = '';
    revealedLenRef.current = 0;
    cancelReveal();

    const controller = new AbortController();
    abortRef.current = controller;
    const clientMessageId = crypto.randomUUID();

    let accumulated = '';
    let lastModel: string | undefined;
    let lastSessionId: string | undefined;
    let lastUsage: TokenUsageSummary | undefined;
    const debugA2uiMessages: A2uiPayloadItem[] = [];

    // Build client messages for potential session rehydration
    const clientMessages = chatHistory
      ?.filter((m) => {
        const text = m.text?.trim();
        if (!text) return false;
        if (m.role === 'user') return true;
        return m.role === 'assistant' && Boolean(m.model);
      })
      .map((m) => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text.trim(),
        ...(m.phase ? { phase: m.phase } : {}),
        ...(m.usage ? { usage: m.usage } : {}),
      }));

    try {
      const res = await apiFetch('/api/converse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          sessionId,
          message,
          stream: true,
          clientMessageId,
          ...(clientMessages?.length ? { messages: clientMessages } : {}),
        }),
        signal: controller.signal,
      }, debugMode);

      if (res.status === 406) {
        // Streaming not available — fall back to non-streaming JSON path.
        const result = await _performSdkNonStreamingFetch(
          {
            sessionId,
            message,
            clientMessages,
            signal: controller.signal,
            debugMode: Boolean(debugMode),
          },
          {
            onPhase: callbacks.onPhase,
            onA2UI: callbacks.onA2UI,
          },
          debugA2uiMessages,
          apiFetch,
        );
        updateRevealTarget(result.text);
        if (result.text) callbacks.onChunk(result.text);
        if (targetTextRef.current.length > 0 && revealedLenRef.current < targetTextRef.current.length) {
          await new Promise<void>(resolve => { revealDoneRef.current = resolve; });
        }
        const debugInfo: DebugMetadata | undefined = debugMode
          ? {
              model: result.model,
              rawResponse: result.text,
              fullEnvelope: {
                message: result.text,
                a2ui: debugA2uiMessages.length > 0 ? debugA2uiMessages : undefined,
                model: result.model,
              },
            }
          : undefined;
        callbacks.onComplete(result.text, result.model, result.sessionId, debugInfo);
        return;
      }

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEventType = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
            continue;
          }

          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed: Record<string, unknown> = JSON.parse(data);

            switch (currentEventType) {
              // v2 typed events
              case 'start':
                if (parsed.sessionId) lastSessionId = parsed.sessionId as string;
                break;

              case 'chunk': {
                const delta = (parsed.delta as string) ?? '';
                accumulated += delta;
                updateRevealTarget(accumulated);
                callbacks.onChunk(accumulated);
                if (isRawA2uiItem(parsed)) {
                  if (debugMode) debugA2uiMessages.push(parsed as A2uiPayloadItem);
                  callbacks.onA2UI([parsed as A2uiPayloadItem]);
                }
                break;
              }

              case 'tool_start':
              case 'tool_done':
                // Tool lifecycle — no UI callback needed for v2 core; future steps may add one
                break;

              case 'phase':
                if (typeof parsed.agent === 'string') {
                  // Agent handoff — treat as a phase-like transition signal
                  callbacks.onPhase(parsed.agent);
                }
                break;

              case 'user_action_req': {
                callbacks.onUserActionReq?.({
                  sessionId: parsed.sessionId as string,
                  actionId: parsed.actionId as string,
                  toolName: parsed.toolName as string,
                  wireName: parsed.wireName as string,
                  parameters: parsed.parameters,
                  confirmComponent: parsed.confirmComponent as { component: string; props?: Record<string, unknown> } | undefined,
                  scopes: (parsed.scopes as string[]) ?? [],
                  cancellation: (parsed.cancellation as 'supported' | 'not-supported' | undefined) ?? 'not-supported',
                });
                // Pause streaming — caller is responsible for dispatching to /resume
                setIsStreaming(false);
                return;
              }

              case 'end': {
                if (parsed.sessionId) lastSessionId = parsed.sessionId as string;
                if (parsed.intent && typeof parsed.intent === 'string') {
                  callbacks.onIntent?.({ summary: parsed.intent });
                }
                break;
              }

              case 'error': {
                const msg = (parsed.message as string) ?? 'Unknown error from server';
                await reader.cancel();
                controller.abort();
                callbacks.onError(msg);
                return;
              }

              default: {
                // v1 / generic event fallback — backward compat
                if (parsed.error) {
                  await reader.cancel();
                  controller.abort();
                  callbacks.onError(parsed.error as string);
                  return;
                }
                if (parsed.delta) {
                  accumulated += parsed.delta as string;
                  updateRevealTarget(accumulated);
                  callbacks.onChunk(accumulated);
                }
                if (parsed.a2ui && Array.isArray(parsed.a2ui)) {
                  const safeItems = (parsed.a2ui as unknown[]).filter(isRawA2uiItem);
                  if (safeItems.length > 0) {
                    if (debugMode) debugA2uiMessages.push(...safeItems);
                    callbacks.onA2UI(safeItems);
                  }
                }
                if (parsed.phase && typeof parsed.phase === 'string') {
                  callbacks.onPhase(parsed.phase);
                }
                if (parsed.model) lastModel = parsed.model as string;
                if (parsed.sessionId) lastSessionId = parsed.sessionId as string;
                if (parsed.usage) lastUsage = parsed.usage as TokenUsageSummary;
                if (parsed.step_start || parsed.file_generated || parsed.step_complete || parsed.step_error) {
                  callbacks.onSetupEvent({ type: currentEventType, ...parsed } as SetupGenerationEvent);
                }
                break;
              }
            }

            currentEventType = '';
          } catch { /* skip malformed JSON */ }
        }
      }

      // Wait for progressive reveal to finish before completing
      if (targetTextRef.current.length > 0 && revealedLenRef.current < targetTextRef.current.length) {
        await new Promise<void>(resolve => {
          revealDoneRef.current = resolve;
        });
      }

      if (controller.signal.aborted) return;

      const debugInfo: DebugMetadata | undefined = debugMode
        ? {
            model: lastModel,
            rawResponse: accumulated,
            fullEnvelope: {
              message: accumulated,
              a2ui: debugA2uiMessages.length > 0 ? debugA2uiMessages : undefined,
              model: lastModel,
              usage: lastUsage,
            },
          }
        : undefined;

      callbacks.onComplete(accumulated, lastModel, lastSessionId, debugInfo, lastUsage);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      cancelReveal();
      if (err instanceof SessionExpiredError) {
        callbacks.onError(err.message);
        window.location.href = '/.auth/login/aad?post_login_redirect_uri=/';
        return;
      }
      const errMsg = err instanceof Error ? err.message : 'Connection failed';
      callbacks.onError(errMsg);
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [updateRevealTarget, cancelReveal]);

  // Cancel rAF on unmount
  useEffect(() => {
    return () => cancelReveal();
  }, [cancelReveal]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    cancelReveal();
    setIsStreaming(false);
  }, [cancelReveal]);

  return { send, isStreaming, streamText, abort };
}
