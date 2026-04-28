// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setGitHubAuthHook,
  useGitHubAuthBridge,
  isGitHubAuthHookSet,
  __resetGitHubAuthHookForTests,
} from '../auth-bridge.js';
import type { GitHubAuthBridgeValue, GitHubAuthHook } from '../auth-bridge.types.js';

const SAMPLE_VALUE: GitHubAuthBridgeValue = {
  loading: false,
  session: {
    authenticated: true,
    configured: true,
    viewer: {
      login: 'octocat',
      name: 'The Octocat',
      avatarUrl: 'https://github.com/octocat.png',
      htmlUrl: 'https://github.com/octocat',
    },
    owners: [
      {
        login: 'octocat',
        type: 'User',
        label: 'octocat',
        avatarUrl: 'https://github.com/octocat.png',
        htmlUrl: 'https://github.com/octocat',
      },
    ],
  },
  authenticated: true,
  error: undefined,
  signIn: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  refresh: () => Promise.resolve(),
};

describe('GitHubAuthBridge contract (issue #179)', () => {
  beforeEach(() => {
    __resetGitHubAuthHookForTests();
  });

  it('starts unset before bootstrap', () => {
    expect(isGitHubAuthHookSet()).toBe(false);
  });

  it('useGitHubAuthBridge() throws fail-fast when the hook is unset', () => {
    expect(() => useGitHubAuthBridge()).toThrowError(
      /GitHubAuthBridge\.hook not set/,
    );
  });

  it('after setGitHubAuthHook(), useGitHubAuthBridge() returns the injected value', () => {
    const hook: GitHubAuthHook = () => SAMPLE_VALUE;
    setGitHubAuthHook(hook);
    expect(isGitHubAuthHookSet()).toBe(true);
    const v = useGitHubAuthBridge();
    expect(v).toBe(SAMPLE_VALUE);
    expect(v.session?.viewer?.login).toBe('octocat');
  });

  it('rejects a second setGitHubAuthHook() call (single-assignment / Zapp condition #1)', () => {
    setGitHubAuthHook(() => SAMPLE_VALUE);
    expect(() => setGitHubAuthHook(() => SAMPLE_VALUE)).toThrowError(
      /single-assignment/,
    );
  });

  it('rejects non-function inputs', () => {
    // @ts-expect-error — runtime guard
    expect(() => setGitHubAuthHook(null)).toThrow(TypeError);
    // @ts-expect-error — runtime guard
    expect(() => setGitHubAuthHook({})).toThrow(TypeError);
  });

  it('__resetGitHubAuthHookForTests() restores the unset state', () => {
    setGitHubAuthHook(() => SAMPLE_VALUE);
    expect(isGitHubAuthHookSet()).toBe(true);
    __resetGitHubAuthHookForTests();
    expect(isGitHubAuthHookSet()).toBe(false);
    expect(() => useGitHubAuthBridge()).toThrow();
  });

  it('does not log auth payload values (Zapp condition #3 — no leakage)', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      setGitHubAuthHook(() => SAMPLE_VALUE);
      useGitHubAuthBridge();
      expect(consoleSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('throws if invoked in a non-browser environment (SSR safety)', () => {
    const originalWindow = (globalThis as { window?: unknown }).window;
    try {
      delete (globalThis as { window?: unknown }).window;
      __resetGitHubAuthHookForTests();
      expect(() => setGitHubAuthHook(() => SAMPLE_VALUE)).toThrowError(
        /browser environment/,
      );
    } finally {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });
});
