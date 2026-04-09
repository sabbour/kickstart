/**
 * useMockStreaming — drop-in replacement for useStreaming that returns
 * canned demo data instead of calling the real API.
 *
 * Same public interface: { send, isStreaming, streamText, abort }
 */

import { useState, useCallback, useRef } from 'react';
import { sendMock, resetMockState } from '../services/mock-streaming';
import type { A2uiMsg } from '../types';

interface MockStreamCallbacks {
  onDelta: (text: string) => void;
  onA2UI: (messages: A2uiMsg[]) => void;
  onPhase: (phase: string) => void;
  onComplete: (fullText: string, model: string) => void;
  onError: (error: string) => void;
}

export function useMockStreaming() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback((
    message: string,
    sessionId: string | undefined,
    callbacks: MockStreamCallbacks,
  ) => {
    setIsStreaming(true);
    setStreamText('');

    const controller = sendMock(message, sessionId, {
      onDelta: (text) => {
        setStreamText(text);
        callbacks.onDelta(text);
      },
      onA2UI: callbacks.onA2UI,
      onPhase: callbacks.onPhase,
      onComplete: (fullText, model) => {
        setIsStreaming(false);
        abortRef.current = null;
        callbacks.onComplete(fullText, model);
      },
      onError: (error) => {
        setIsStreaming(false);
        abortRef.current = null;
        callbacks.onError(error);
      },
    });

    abortRef.current = controller;
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    resetMockState();
  }, []);

  return { send, isStreaming, streamText, abort, reset };
}
