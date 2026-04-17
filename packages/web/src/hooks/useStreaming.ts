import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  StreamEvent,
  A2uiPayloadItem,
  DebugMetadata,
  ChatMessage,
  SetupGenerationEvent,
  TokenUsageSummary,
} from '../types';
import { apiFetch, SessionExpiredError } from '../services/api-client';

// ---------------------------------------------------------------------------
// Phase allowlist guard (C4) and A2UI item type guard (C1)
// ---------------------------------------------------------------------------

/** Known server-emitted phase identifiers. Values outside this set are silently dropped. */
const KNOWN_SERVER_PHASES = new Set([
  'discover', 'design', 'generate', 'review', 'handoff', 'deploy',
]);

/**
 * Validates a server-emitted phase string against the known-phases allowlist.
 * Returns the normalised phase on success, or null if the value is unrecognised.
 * Emits a console.warn in non-production builds.
 */
function guardServerPhase(phase: string): string | null {
  const normalized = phase.trim().toLowerCase();
  if (KNOWN_SERVER_PHASES.has(normalized)) return normalized;
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[useStreaming] ignoring unknown server phase: "${phase}"`);
  }
  return null;
}

/**
 * Runtime type guard for A2UI items arriving over the wire.
 * The backend types `a2ui` as `object[]`; this guard ensures each element is
 * a non-null, non-array plain object before it is forwarded to callbacks.
 */
function isRawA2uiItem(item: unknown): item is A2uiPayloadItem {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

// ---------------------------------------------------------------------------
// SDK 406 fallback — exported for unit testing (C2, C3)
// ---------------------------------------------------------------------------

/**
 * Executes the non-streaming JSON request used when the SDK path rejects
 * streaming (HTTP 406).  Validates the response and fires `onPhase` /
 * `onA2UI` callbacks.  `onComplete` is the caller's responsibility so that
 * progressive text reveal can be awaited before signalling completion.
 *
 * setupGeneration is intentionally NOT forwarded: the SDK non-streaming path
 * may return a SetupGenerationSnapshot (final state only), but `onSetupEvent`
 * expects incremental SetupGenerationEvent items (step_start / file_generated
 * / …).  Translating a snapshot into synthetic events is not safe here.
 *
 * @internal Exported for unit testing only; not part of the public hook API.
 */
export async function _performSdkNonStreamingFetch(
  params: {
    sessionId: string | undefined;
    message: string;
    /**
     * Idempotency key generated at the start of the turn.  Both the initial
     * streaming attempt and this fallback include the same value so the server
     * can deduplicate the user message if the 406 path is not side-effect free.
     */
    clientMessageId?: string;
    clientMessages: unknown[] | undefined;
    signal: AbortSignal;
    debugMode: boolean;
  },
  callbacks: Pick<StreamCallbacks, 'onPhase' | 'onA2UI'>,
  debugA2uiMessages: A2uiPayloadItem[],
  apiFetchFn: typeof apiFetch = apiFetch,
): Promise<{ text: string; model?: string; sessionId?: string; phase?: string; usage?: TokenUsageSummary }> {
  const jsonRes = await apiFetchFn('/api/converse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: params.sessionId,
      message: params.message,
      ...(params.clientMessageId ? { clientMessageId: params.clientMessageId } : {}),
      ...(params.clientMessages?.length ? { messages: params.clientMessages } : {}),
    }),
    signal: params.signal,
  }, params.debugMode);

  if (!jsonRes.ok) throw new Error(`API error: ${jsonRes.status}`);

  const response = await jsonRes.json() as {
    sessionId?: string;
    phase?: string;
    message?: string;
    model?: string;
    a2ui?: unknown[];
    usage?: TokenUsageSummary;
  };

  let safePhase: string | undefined;
  if (response.phase) {
    const validated = guardServerPhase(response.phase);
    if (validated) {
      safePhase = validated;
      callbacks.onPhase(validated);
    }
  }

  const safeItems = (response.a2ui ?? []).filter(isRawA2uiItem);
  if (safeItems.length > 0) {
    if (params.debugMode) debugA2uiMessages.push(...safeItems);
    callbacks.onA2UI(safeItems);
  }

  return {
    text: response.message ?? '',
    model: response.model,
    sessionId: response.sessionId,
    phase: safePhase,
    usage: response.usage,
  };
}

interface StreamCallbacks {
  onDelta: (text: string) => void;
  onA2UI: (messages: A2uiPayloadItem[]) => void;
  onSetupEvent: (event: SetupGenerationEvent) => void;
  onPhase: (phase: string) => void;
  onComplete: (
    fullText: string,
    model?: string,
    sessionId?: string,
    debugInfo?: DebugMetadata,
    usage?: TokenUsageSummary,
  ) => void;
  onError: (error: string) => void;
}

// Target ~80 rAF frames to reveal all text (~1.3s at 60fps)
const REVEAL_FRAMES = 80;

function extractHydrationA2uiMessages(items: A2uiPayloadItem[] | undefined): A2uiPayloadItem[] | undefined {
  const artifactMessages = items?.filter((item) => {
    if (!('updateComponents' in item) || !Array.isArray(item.updateComponents?.components)) {
      return false;
    }

    return item.updateComponents.components.some((component) =>
      Boolean(component)
      && typeof component === 'object'
      && !Array.isArray(component)
      && (component as { component?: unknown }).component === 'FileEditor',
    );
  });

  return artifactMessages?.length ? artifactMessages : undefined;
}

export function useStreaming() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Progressive text reveal — buffers incoming text and reveals it
  // character-by-character via requestAnimationFrame so the user sees
  // a typing effect even when all SSE events arrive in one burst.
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
    /** Full message history for session rehydration on cold starts. */
    chatHistory?: ChatMessage[],
  ) => {
    setIsStreaming(true);
    setStreamText('');
    targetTextRef.current = '';
    revealedLenRef.current = 0;
    cancelReveal();

    const controller = new AbortController();
    abortRef.current = controller;

    // One idempotency key per turn — included in both the streaming attempt
    // and the 406 fallback so the server can deduplicate the user message if
    // its 406 path is not side-effect free.
    const clientMessageId = crypto.randomUUID();

    let accumulated = '';
    let displayText = '';
    let lastModel: string | undefined;
      let lastSessionId: string | undefined;
      let lastPhase: string | undefined;
      let lastUsage: TokenUsageSummary | undefined;
      let sawStepwiseEvent = false;
      const debugA2uiMessages: A2uiPayloadItem[] = [];

    try {
      // Build client message history for rehydration. The server rebuilds its
      // own system prompt, so only user/assistant text is required. For
      // assistant turns we also forward compact artifact-bearing A2UI payloads
      // so generated files can be rebuilt after cold starts without re-leaking
      // them into chat.
      // Filter assistant messages to only model-produced ones (m.model present)
      // to prevent client-generated error bubbles from spoofing assistant turns.
      const clientMessages = chatHistory
        ?.filter((m) => {
          const text = m.text?.trim();
          if (!text) return false;
          if (m.role === 'user') return true;
          return m.role === 'assistant' && Boolean(m.model);
        })
        .map((m) => {
          const a2uiMessages = m.role === 'assistant'
            ? extractHydrationA2uiMessages(m.a2uiMessages)
            : undefined;

          return {
            role: m.role === 'user' ? 'user' as const : 'assistant' as const,
            content: m.text.trim(),
            ...(m.phase ? { phase: m.phase } : {}),
            ...(m.usage ? { usage: m.usage } : {}),
            ...(a2uiMessages ? { a2uiMessages } : {}),
          };
        });

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

      if (!res.ok) {
        // HTTP 406: the SDK path rejected streaming. Fall back to a non-streaming
        // JSON request so the SDK turn completes and the server-emitted route state
        // (phase, A2UI) still reaches the frontend through the same callbacks.
        if (res.status === 406) {
          const fallback = await _performSdkNonStreamingFetch(
            { sessionId, message, clientMessageId, clientMessages, signal: controller.signal, debugMode: !!debugMode },
            { onPhase: callbacks.onPhase, onA2UI: callbacks.onA2UI },
            debugA2uiMessages,
          );

          if (fallback.model) lastModel = fallback.model;
          if (fallback.sessionId) lastSessionId = fallback.sessionId;
          if (fallback.phase) lastPhase = fallback.phase;
          if (fallback.usage) lastUsage = fallback.usage;

          const nonStreamText = fallback.text;
          updateRevealTarget(nonStreamText);

          // Wait for progressive reveal before firing completion
          if (targetTextRef.current.length > 0 && revealedLenRef.current < targetTextRef.current.length) {
            await new Promise<void>(resolve => { revealDoneRef.current = resolve; });
          }

          if (!controller.signal.aborted) {
            const debugInfo: DebugMetadata | undefined = debugMode
              ? {
                  model: lastModel,
                  rawResponse: nonStreamText,
                  fullEnvelope: {
                    message: nonStreamText,
                    a2ui: debugA2uiMessages.length > 0 ? debugA2uiMessages : undefined,
                    model: lastModel,
                    phase: lastPhase,
                    usage: lastUsage,
                  },
                }
              : undefined;
            callbacks.onComplete(nonStreamText, lastModel, lastSessionId, debugInfo, lastUsage);
          }
          return;
        }

        throw new Error(`API error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      // Track the SSE event type so typed events (e.g. `event: a2ui`) are routed correctly
      let currentEventType = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          // Track SSE event type field
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
            continue;
          }

          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            // --- Typed SSE events ---

            if (currentEventType === 'a2ui') {
              const a2uiMsg: A2uiPayloadItem = JSON.parse(data);
              if (debugMode) debugA2uiMessages.push(a2uiMsg);
              callbacks.onA2UI([a2uiMsg]);
              currentEventType = '';
              continue;
            }

            if (currentEventType === 'chunk') {
              // Raw LLM output fragment — accumulate for debug but don't display
              const parsed = JSON.parse(data);
              if (parsed.content) accumulated += parsed.content;
              currentEventType = '';
              continue;
            }

            if (currentEventType === 'message') {
              // Processed display text — progressive reveal target
              const parsed = JSON.parse(data);
              if (parsed.content) {
                displayText = parsed.content;
                updateRevealTarget(displayText);
              }
              currentEventType = '';
              continue;
            }

             if (currentEventType === 'done') {
               const parsed = JSON.parse(data);
               if (parsed.model) lastModel = parsed.model;
              if (parsed.sessionId) lastSessionId = parsed.sessionId;
              if (parsed.phase) {
                const safePhase = guardServerPhase(parsed.phase);
                if (safePhase) {
                  lastPhase = safePhase;
                  callbacks.onPhase(safePhase);
                }
              }
              if (parsed.usage) {
                lastUsage = parsed.usage as TokenUsageSummary;
              }
               currentEventType = '';
               continue;
             }

             if (isStepwiseEventType(currentEventType)) {
               sawStepwiseEvent = true;
               callbacks.onSetupEvent({
                 type: currentEventType,
                 ...JSON.parse(data),
               } as SetupGenerationEvent);
               currentEventType = '';
               continue;
             }

             // --- Generic (untyped) events — backward compatibility ---
             const event: StreamEvent = JSON.parse(data);
            currentEventType = '';

            if (event.error) {
              await reader.cancel();
              controller.abort();
              callbacks.onError(event.error);
              return;
            }

            if (event.delta) {
              accumulated += event.delta;
              updateRevealTarget(accumulated);
              callbacks.onDelta(accumulated);
            }

            if (event.content) {
              accumulated = event.content;
              updateRevealTarget(accumulated);
              callbacks.onDelta(accumulated);
            }

            if (event.a2ui && event.a2ui.length > 0) {
              if (debugMode) debugA2uiMessages.push(...event.a2ui);
              callbacks.onA2UI(event.a2ui);
            }

            if (event.phase) {
              const safePhase = guardServerPhase(event.phase);
              if (safePhase) {
                lastPhase = safePhase;
                callbacks.onPhase(safePhase);
              }
            }

            if (event.model) {
              lastModel = event.model;
            }

            if (event.sessionId) {
              lastSessionId = event.sessionId;
            }

            if (event.usage) {
              lastUsage = event.usage;
            }

          } catch { /* skip malformed JSON */ }
        }
      }

      // Determine the final display text
      let finalText = sawStepwiseEvent ? displayText : (displayText || accumulated);

      // If no typed `message` event was received, try extracting from JSON envelope
      if (!displayText && !sawStepwiseEvent) {
        try {
          const envelope = JSON.parse(accumulated);
          if (typeof envelope?.message === 'string') {
            finalText = envelope.message;
          }
          if (Array.isArray(envelope?.a2ui) && envelope.a2ui.length > 0) {
            if (debugMode) debugA2uiMessages.push(...envelope.a2ui);
            callbacks.onA2UI(envelope.a2ui);
          }
        } catch { /* plain text, not JSON — use as-is */ }

        updateRevealTarget(finalText);
      }

      // Wait for progressive reveal to finish before completing
      if (targetTextRef.current.length > 0 && revealedLenRef.current < targetTextRef.current.length) {
        await new Promise<void>(resolve => {
          revealDoneRef.current = resolve;
        });
      }

      // Don't fire completion if aborted during the reveal
      if (controller.signal.aborted) return;

      // Build debug info when debug mode is active
      const debugInfo: DebugMetadata | undefined = debugMode
        ? {
            model: lastModel,
            rawResponse: finalText,
            rawContent: accumulated !== finalText ? accumulated : undefined,
            fullEnvelope: {
              message: finalText,
              a2ui: debugA2uiMessages.length > 0 ? debugA2uiMessages : undefined,
              model: lastModel,
              phase: lastPhase,
              usage: lastUsage,
            },
          }
        : undefined;

      callbacks.onComplete(finalText, lastModel, lastSessionId, debugInfo, lastUsage);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      cancelReveal();
      if (err instanceof SessionExpiredError) {
        callbacks.onError(err.message);
        window.location.href = '/.auth/login/aad?post_login_redirect_uri=/';
        return;
      }
      callbacks.onError(err.message || 'Connection failed');
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [updateRevealTarget, cancelReveal]);

  // Cancel any in-flight rAF on unmount to avoid setState on an unmounted component
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

function isStepwiseEventType(value: string): value is SetupGenerationEvent['type'] {
  return value === 'step_start'
    || value === 'file_generated'
    || value === 'step_complete'
    || value === 'step_error';
}
