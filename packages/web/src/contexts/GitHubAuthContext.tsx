import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePlaygroundMockMode } from './PlaygroundMockModeContext';
import {
  getGitHubSession,
  signInWithGitHubPopup,
  signOutGitHub,
  type GitHubSessionState,
  type GitHubOwnerSummary,
} from '../services/github-handoff';

const MOCK_OWNER: GitHubOwnerSummary = {
  login: 'kickstart-mock',
  type: 'User',
  label: 'kickstart-mock (mock)',
  avatarUrl: 'https://github.com/github.png',
  htmlUrl: 'https://github.com/kickstart-mock',
};

const MOCK_SESSION: GitHubSessionState = {
  authenticated: true,
  configured: true,
  viewer: {
    login: 'kickstart-mock',
    name: 'Mock GitHub User',
    avatarUrl: 'https://github.com/github.png',
    htmlUrl: 'https://github.com/kickstart-mock',
  },
  owners: [MOCK_OWNER],
};

export interface GitHubAuthContextValue {
  /** Whether the GitHub session check is in progress. */
  loading: boolean;
  /** Current session state (null if not yet loaded or signed out). */
  session: GitHubSessionState | null;
  /** Whether the user is currently authenticated with GitHub. */
  authenticated: boolean;
  /** Non-null when the last sign-in attempt or session check failed. */
  error: string | undefined;
  /**
   * Initiate sign-in. In mock mode uses stub data. In real mode opens the
   * GitHub OAuth popup (falls back to redirect if popup is blocked).
   */
  signIn: () => Promise<void>;
  /** Clear local auth state and call the GitHub logout endpoint. */
  signOut: () => Promise<void>;
  /** Re-check the session (e.g. after a popup-flow completes). */
  refresh: () => Promise<void>;
}

const GitHubAuthContext = createContext<GitHubAuthContextValue | null>(null);

interface GitHubAuthProviderProps {
  children: ReactNode;
}

export function GitHubAuthProvider({ children }: GitHubAuthProviderProps) {
  const [mockMode] = usePlaygroundMockMode();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<GitHubSessionState | null>(null);
  const [error, setError] = useState<string | undefined>();

  // Prevent overlapping fetches
  const fetchingRef = useRef(false);

  const applySession = useCallback((s: GitHubSessionState) => {
    setSession(s);
    if (s.error) {
      setError(s.error);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(undefined);

    try {
      if (mockMode) {
        applySession(MOCK_SESSION);
        return;
      }
      const s = await getGitHubSession();
      applySession(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check GitHub session.');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [applySession, mockMode]);

  // Auto-detect existing session on mount.
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check when mock mode toggles so the UI reflects the right state.
  const prevMockMode = useRef(mockMode);
  useEffect(() => {
    if (prevMockMode.current === mockMode) return;
    prevMockMode.current = mockMode;
    void refresh();
  }, [mockMode, refresh]);

  const signIn = useCallback(async () => {
    if (mockMode) {
      applySession(MOCK_SESSION);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const s = await signInWithGitHubPopup();
      applySession(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  }, [applySession, mockMode]);

  const signOut = useCallback(async () => {
    setError(undefined);
    setSession(null);
    if (!mockMode) {
      try {
        await signOutGitHub();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign-out failed.');
      }
    }
  }, [mockMode]);

  const value = useMemo<GitHubAuthContextValue>(
    () => ({
      loading,
      session,
      authenticated: session?.authenticated ?? false,
      error,
      signIn,
      signOut,
      refresh,
    }),
    [loading, session, error, signIn, signOut, refresh],
  );

  return <GitHubAuthContext.Provider value={value}>{children}</GitHubAuthContext.Provider>;
}

export function useGitHubAuth(): GitHubAuthContextValue {
  const ctx = useContext(GitHubAuthContext);
  if (!ctx) {
    throw new Error('useGitHubAuth must be used within a <GitHubAuthProvider>');
  }
  return ctx;
}
