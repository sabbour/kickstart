import { useState, useCallback, useRef, useEffect } from 'react';

const DEFAULT_STAGGER_MS = 150;

/**
 * Progressively reveals surface IDs one at a time with a stagger delay,
 * giving users the perception that components are appearing as the LLM
 * generates them rather than popping in all at once.
 */
export function useProgressiveQueue(staggerMs = DEFAULT_STAGGER_MS) {
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const queueRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef<string[]>([]);

  const drainNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      timerRef.current = null;
      return;
    }

    const next = queueRef.current.shift()!;
    visibleRef.current = [...visibleRef.current, next];
    setVisibleIds([...visibleRef.current]);

    if (queueRef.current.length > 0) {
      timerRef.current = setTimeout(drainNext, staggerMs);
    } else {
      timerRef.current = null;
    }
  }, [staggerMs]);

  const enqueue = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    queueRef.current.push(...ids);

    // Start draining if not already running
    if (!timerRef.current) {
      timerRef.current = setTimeout(drainNext, staggerMs);
    }
  }, [staggerMs, drainNext]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (queueRef.current.length > 0) {
      visibleRef.current = [...visibleRef.current, ...queueRef.current];
      queueRef.current = [];
      setVisibleIds([...visibleRef.current]);
    }
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    queueRef.current = [];
    visibleRef.current = [];
    setVisibleIds([]);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { visibleIds, enqueue, flush, reset };
}
