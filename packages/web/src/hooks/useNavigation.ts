import { useEffect, useCallback, useRef } from 'react';
import type { AppIntent } from '@aks-kickstart/harness';

/**
 * Hash-based navigation for browser back/forward button support.
 *
 * URL patterns:
 *   #              → landing page
 *   #session/{id}  → chat session (deep-linkable)
 */

export interface NavState {
  view: 'landing' | 'session';
  sessionId?: string;
}

/**
 * onIntent callback type — invoked when the v2 streaming layer receives an
 * intent value from the `end` SSE event.
 *
 * TODO(Step 6, #480): Full intent→navigation routing will be implemented when
 * the skill resolver and agent phase FSM arrive. For now, callers may register
 * this callback to receive intent signals but no automatic navigation occurs.
 */
export type OnIntentCallback = (intent: AppIntent) => void;

/** Parse current hash into a NavState. */
export function parseHash(hash: string): NavState {
  const h = hash.replace(/^#/, '');
  const match = h.match(/^session\/(.+)$/);
  if (match) {
    return { view: 'session', sessionId: match[1] };
  }
  return { view: 'landing' };
}

function hashForState(state: NavState): string {
  if (state.view === 'session' && state.sessionId) {
    return `#session/${state.sessionId}`;
  }
  return '#';
}

export function useNavigation(onNavigate: (state: NavState) => void) {
  // Keep a stable ref so the popstate listener always sees the latest callback
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  // Track the last state we pushed to avoid duplicate pushes
  const lastPushedRef = useRef<string>(window.location.hash);

  // Listen for browser back/forward
  useEffect(() => {
    const handler = () => {
      const state = parseHash(window.location.hash);
      lastPushedRef.current = window.location.hash;
      onNavigateRef.current(state);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  /** Push a session view onto the history stack. */
  const pushSession = useCallback((sessionId: string) => {
    const target = `#session/${sessionId}`;
    if (window.location.hash !== target) {
      window.history.pushState(null, '', target);
      lastPushedRef.current = target;
    }
  }, []);

  /** Push the landing view onto the history stack. */
  const pushLanding = useCallback(() => {
    const target = '#';
    if (window.location.hash !== '' && window.location.hash !== '#') {
      window.history.pushState(null, '', target);
      lastPushedRef.current = target;
    }
  }, []);

  /** Replace the current entry (no new history entry). */
  const replaceCurrent = useCallback((state: NavState) => {
    const target = hashForState(state);
    window.history.replaceState(null, '', target);
    lastPushedRef.current = target;
  }, []);

  /** Read the initial state from the URL (call once on mount). */
  const getInitialState = useCallback((): NavState => {
    return parseHash(window.location.hash);
  }, []);

  return { pushSession, pushLanding, replaceCurrent, getInitialState };
}
