/**
 * Mock streaming provider — simulates the SSE streaming pipeline
 * using canned responses from demo-scenarios.ts.
 *
 * Activated via ?mock URL parameter. Each user message advances
 * through the scenario sequence: WELCOME → ARCHITECTURE →
 * DESIGN_DETAIL → CONFIGURE_FORM → CODE_PREVIEW → FILE_GENERATION
 * → REVIEW → DEPLOY_SUCCESS.
 */

import { getDemoResponse, resetDemoState } from './demo-scenarios';
import type { A2uiMsg, A2uiPayloadItem } from '../types';

const MOCK_MODEL = 'gpt-5.4-mini (mock)';

interface MockStreamCallbacks {
  onDelta: (text: string) => void;
  onA2UI: (messages: A2uiPayloadItem[]) => void;
  onPhase: (phase: string) => void;
  onComplete: (fullText: string, model: string) => void;
  onError: (error: string) => void;
}

/** Reset mock state so the next send() starts from WELCOME. */
export function resetMockState(): void {
  resetDemoState();
}

/**
 * Simulate streaming a canned demo response word-by-word.
 * Returns an AbortController so the caller can cancel mid-stream.
 */
export function sendMock(
  message: string,
  _sessionId: string | undefined,
  callbacks: MockStreamCallbacks,
): AbortController {
  const controller = new AbortController();
  const signal = controller.signal;

  const response = getDemoResponse(message);
  const words = response.text.split(/(\s+)/); // keep whitespace tokens
  let accumulated = '';
  let wordIdx = 0;

  const tick = () => {
    if (signal.aborted) return;

    if (wordIdx < words.length) {
      accumulated += words[wordIdx];
      wordIdx++;
      callbacks.onDelta(accumulated);

      // Randomised delay 30-50ms per token for realism
      const delay = 30 + Math.random() * 20;
      setTimeout(tick, delay);
    } else {
      // Streaming complete — emit A2UI surfaces progressively (one at a time)
      emitSurfacesProgressively(response.a2uiMessages, signal, callbacks, () => {
        if (response.phase) {
          callbacks.onPhase(response.phase);
        }
        callbacks.onComplete(accumulated, MOCK_MODEL);
      });
    }
  };

  // Kick off after a small initial delay to feel natural
  setTimeout(tick, 80);

  return controller;
}

/** Whether ?mock is present in the current URL. */
export function isMockMode(): boolean {
  return new URLSearchParams(window.location.search).has('mock');
}

/** Whether ?playground is present in the current URL. */
export function isPlaygroundMode(): boolean {
  return new URLSearchParams(window.location.search).has('playground');
}

const SURFACE_STAGGER_MS = 200;

/**
 * Emit A2UI messages surface-by-surface with staggered timing.
 * Groups each createSurface + its updateComponents into a pair,
 * then emits one pair at a time with a delay between them.
 */
function emitSurfacesProgressively(
  messages: A2uiMsg[],
  signal: AbortSignal,
  callbacks: MockStreamCallbacks,
  onDone: () => void,
): void {
  if (messages.length === 0) {
    onDone();
    return;
  }

  // Group messages into per-surface batches (createSurface + updateComponents)
  const batches: A2uiMsg[][] = [];
  let currentBatch: A2uiMsg[] = [];

  for (const msg of messages) {
    if (msg.createSurface && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
    }
    currentBatch.push(msg);
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  let batchIdx = 0;
  const emitNext = () => {
    if (signal.aborted) return;
    if (batchIdx >= batches.length) {
      onDone();
      return;
    }

    callbacks.onA2UI(batches[batchIdx]);
    batchIdx++;

    if (batchIdx < batches.length) {
      setTimeout(emitNext, SURFACE_STAGGER_MS);
    } else {
      onDone();
    }
  };

  // Emit the first surface immediately, rest with stagger
  emitNext();
}
