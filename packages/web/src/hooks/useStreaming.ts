import { useState, useCallback, useRef } from 'react';
import type { StreamEvent, A2uiMsg, DebugMetadata, ChatMessage } from '../types';
import { apiFetch, SessionExpiredError } from '../services/api-client';

interface StreamCallbacks {
  onDelta: (text: string) => void;
  onA2UI: (messages: A2uiMsg[]) => void;
  onPhase: (phase: string) => void;
  onComplete: (fullText: string, model?: string, sessionId?: string, debugInfo?: DebugMetadata) => void;
  onError: (error: string) => void;
}

// Target ~80 rAF frames to reveal all text (~1.3s at 60fps)
const REVEAL_FRAMES = 80;

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

    let accumulated = '';
    let displayText = '';
    let lastModel: string | undefined;
    let lastSessionId: string | undefined;
    const renderDecisions: string[] = [];

    try {
      // Build client message history for rehydration (strip system messages
      // and A2UI JSON — the server builds its own system prompt).
      const clientMessages = chatHistory
        ?.filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.text }));

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
          ...(clientMessages?.length ? { messages: clientMessages } : {}),
        }),
        signal: controller.signal,
      }, debugMode);

      if (!res.ok) {
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
              const a2uiMsg: A2uiMsg = JSON.parse(data);
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
              if (parsed.phase) callbacks.onPhase(parsed.phase);
              if (parsed.renderDecisions) renderDecisions.push(...parsed.renderDecisions);
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
              callbacks.onA2UI(event.a2ui);
            }

            if (event.phase) {
              callbacks.onPhase(event.phase);
            }

            if (event.model) {
              lastModel = event.model;
            }

            if (event.sessionId) {
              lastSessionId = event.sessionId;
            }

            if (event.renderDecisions) {
              renderDecisions.push(...event.renderDecisions);
            }
          } catch { /* skip malformed JSON */ }
        }
      }

      // Determine the final display text
      let finalText = displayText || accumulated;

      // If no typed `message` event was received, try extracting from JSON envelope
      if (!displayText) {
        try {
          const envelope = JSON.parse(accumulated);
          if (typeof envelope?.message === 'string') {
            finalText = envelope.message;
          }
          if (Array.isArray(envelope?.a2ui) && envelope.a2ui.length > 0) {
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
            renderDecisions: renderDecisions.length > 0 ? renderDecisions : undefined,
          }
        : undefined;

      callbacks.onComplete(finalText, lastModel, lastSessionId, debugInfo);
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

  const abort = useCallback(() => {
    abortRef.current?.abort();
    cancelReveal();
    setIsStreaming(false);
  }, [cancelReveal]);

  return { send, isStreaming, streamText, abort };
}
