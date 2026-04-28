// @vitest-environment jsdom

/**
 * Integration smoke test for `pack-github/Login` reading auth state through
 * the GitHubAuthBridge (issue #179). Uses `react-dom/server.renderToString`
 * to keep the test free of `@testing-library/react` (not installed in
 * pack-github) while still exercising the full React render cycle including
 * the bridge hook.
 *
 * Verifies:
 *   1. Renderer fails fast if no hook is injected (Nibbler 🟡 pin #2).
 *   2. With an injected unauthenticated bridge → renders an enabled "Sign in"
 *      button (regression guard: PR #190 had left this disabled).
 *   3. With an injected authenticated bridge → renders the viewer login.
 *   4. Reset helper isolates state between tests (Nibbler 🟡 pin #3).
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { LoginRenderer } from '../components/Login/index.js';
import {
  setGitHubAuthHook,
  __resetGitHubAuthHookForTests,
} from '../auth-bridge.js';
import type {
  GitHubAuthBridgeValue,
  GitHubAuthHook,
} from '../auth-bridge.types.js';

// Stub Fluent UI so we render plain DOM strings without pulling the full
// component library (it relies on browser APIs that jsdom lacks here).
vi.mock('@fluentui/react-components', () => {
  const passthrough = (tag: string) => {
    const C: React.FC<React.PropsWithChildren<Record<string, unknown>>> = ({
      children,
      ...rest
    }) =>
      React.createElement(
        tag,
        { 'data-fluent': (rest as { 'data-fluent'?: string })['data-fluent'] },
        children,
      );
    C.displayName = `FluentStub(${tag})`;
    return C;
  };
  return {
    Card: passthrough('div'),
    CardHeader: ({ header }: { header: React.ReactNode }) =>
      React.createElement('header', null, header),
    Text: passthrough('span'),
    Spinner: ({ label }: { label?: string }) =>
      React.createElement('div', { role: 'progressbar' }, label),
    Button: ({
      children,
      onClick,
      disabled,
    }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) =>
      React.createElement(
        'button',
        { onClick, disabled: disabled ?? false },
        children,
      ),
    Avatar: ({ name }: { name: string }) =>
      React.createElement('span', { 'data-avatar': name }, name),
    tokens: new Proxy({}, { get: () => '' }),
    makeStyles: () => () => ({
      card: 'card',
      viewer: 'viewer',
      inactive: 'inactive',
    }),
  };
});

const UNAUTH_VALUE: GitHubAuthBridgeValue = {
  loading: false,
  session: { authenticated: false, configured: true, owners: [] },
  authenticated: false,
  error: undefined,
  signIn: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  refresh: () => Promise.resolve(),
};

const AUTH_VALUE: GitHubAuthBridgeValue = {
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
    owners: [],
  },
  authenticated: true,
  error: undefined,
  signIn: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  refresh: () => Promise.resolve(),
};

const inject = (value: GitHubAuthBridgeValue) => {
  const hook: GitHubAuthHook = () => value;
  setGitHubAuthHook(hook);
};

describe('LoginRenderer × GitHubAuthBridge (issue #179)', () => {
  beforeEach(() => {
    __resetGitHubAuthHookForTests();
  });

  it('throws fail-fast when rendered without a wired bridge', () => {
    expect(() =>
      renderToString(
        React.createElement(LoginRenderer, {
          props: { status: 'idle', isActive: true },
        }),
      ),
    ).toThrowError(/GitHubAuthBridge\.hook not set/);
  });

  it('renders an enabled Sign-in button when bridge reports unauthenticated', () => {
    inject(UNAUTH_VALUE);
    const html = renderToString(
      React.createElement(LoginRenderer, {
        props: { status: 'idle', isActive: true },
      }),
    );
    expect(html).toContain('Sign in with GitHub');
    expect(html).not.toContain('disabled=""');
  });

  it('renders the viewer login when bridge reports authenticated', () => {
    inject(AUTH_VALUE);
    const html = renderToString(
      React.createElement(LoginRenderer, {
        props: { status: 'idle', isActive: true },
      }),
    );
    expect(html).toContain('octocat');
    // React injects a comment node between adjacent text fragments — strip
    // before asserting on the @handle.
    const stripped = html.replace(/<!--.*?-->/g, '');
    expect(stripped).toContain('@octocat');
  });

  it('test-reset helper isolates state across cases', () => {
    inject(AUTH_VALUE);
    __resetGitHubAuthHookForTests();
    expect(() =>
      renderToString(
        React.createElement(LoginRenderer, {
          props: { status: 'idle', isActive: true },
        }),
      ),
    ).toThrow();
  });
});
