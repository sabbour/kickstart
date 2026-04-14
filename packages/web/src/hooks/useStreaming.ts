import { useState, useCallback, useRef } from 'react';
import type { StreamEvent, A2uiMsg, DebugMetadata } from '../types';
import { apiFetch, SessionExpiredError } from '../services/api-client';

interface StreamCallbacks {
  onDelta: (text: string) => void;
  onA2UI: (messages: A2uiMsg[]) => void;
  onPhase: (phase: string) => void;
  onComplete: (fullText: string, model?: string, sessionId?: string, debugInfo?: DebugMetadata) => void;
  onError: (error: string) => void;
}

export function useStreaming() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (
    message: string,
    sessionId: string | undefined,
    callbacks: StreamCallbacks,
    debugMode?: boolean,
  ) => {
    setIsStreaming(true);
    setStreamText('');

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = '';
    let lastModel: string | undefined;
    let lastSessionId: string | undefined;
    const renderDecisions: string[] = [];

    try {
      const res = await apiFetch('/api/converse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ sessionId, message, stream: true }),
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
            // Handle typed SSE events (e.g. `event: a2ui`)
            if (currentEventType === 'a2ui') {
              const a2uiMsg: A2uiMsg = JSON.parse(data);
              callbacks.onA2UI([a2uiMsg]);
              currentEventType = '';
              continue;
            }

            const event: StreamEvent = JSON.parse(data);
            // Reset event type after consuming a data line
            currentEventType = '';

            if (event.error) {
              await reader.cancel();
              controller.abort();
              callbacks.onError(event.error);
              return;
            }

            if (event.delta) {
              accumulated += event.delta;
              setStreamText(accumulated);
              callbacks.onDelta(accumulated);
            }

            if (event.content) {
              accumulated = event.content;
              setStreamText(accumulated);
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

      // Preserve the raw accumulated content before envelope extraction
      const rawContent = accumulated;

      // Extract message/A2UI from the accumulated JSON envelope
      try {
        const envelope = JSON.parse(accumulated);
        if (typeof envelope?.message === 'string') {
          accumulated = envelope.message;
        }
        if (Array.isArray(envelope?.a2ui) && envelope.a2ui.length > 0) {
          callbacks.onA2UI(envelope.a2ui);
        }
      } catch { /* accumulated is plain text, not JSON — expected for non-envelope responses */ }

      // Build debug info when debug mode is active
      const debugInfo: DebugMetadata | undefined = debugMode
        ? {
            model: lastModel,
            rawResponse: accumulated,
            rawContent: rawContent !== accumulated ? rawContent : undefined,
            renderDecisions: renderDecisions.length > 0 ? renderDecisions : undefined,
          }
        : undefined;

      callbacks.onComplete(accumulated, lastModel, lastSessionId, debugInfo);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
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
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { send, isStreaming, streamText, abort };
}
