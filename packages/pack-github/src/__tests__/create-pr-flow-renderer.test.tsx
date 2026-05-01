// @vitest-environment jsdom

/**
 * Renderer tests for `github/CreatePRFlow` (#328).
 *
 * Covers the three-stage publisher flow asserted by
 * `packages/web/e2e/phase-d-publisher-pr.spec.ts`:
 *   1. idle  → file list + PR title rendered as visible text (not as
 *              `<input value=…>`, which Playwright's `getByText` cannot match).
 *   2. pushing / creating_pr → spinner + status message visible.
 *   3. done  → PR link rendered with `target="_blank"` and `rel="noopener noreferrer"`.
 *   4. error → renders the error message.
 *
 * Uses `react-dom/server.renderToString` so we can stay free of
 * `@testing-library/react` (not installed in pack-github), matching the
 * pattern in `login-bridge.test.tsx`.
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@fluentui/react-components', () => {
  const passthrough = (tag: string) => {
    const C: React.FC<React.PropsWithChildren<Record<string, unknown>>> = ({
      children,
      ...rest
    }) => {
      const safe: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (
          k === 'id' ||
          k === 'href' ||
          k === 'target' ||
          k === 'rel' ||
          k === 'className' ||
          k === 'htmlFor' ||
          k === 'role' ||
          k.startsWith('data-') ||
          k.startsWith('aria-')
        ) {
          safe[k] = v;
        }
      }
      return React.createElement(tag, safe, children);
    };
    C.displayName = `FluentStub(${tag})`;
    return C;
  };
  return {
    Card: passthrough('div'),
    CardHeader: ({
      header,
      description,
    }: {
      header?: React.ReactNode;
      description?: React.ReactNode;
    }) =>
      React.createElement(
        'header',
        null,
        header,
        description ? React.createElement('div', null, description) : null,
      ),
    Text: passthrough('span'),
    Spinner: ({ label }: { label?: string }) =>
      React.createElement('div', { role: 'progressbar' }, label ?? 'loading'),
    Label: passthrough('label'),
    Link: ({
      children,
      href,
      target,
      rel,
    }: React.PropsWithChildren<{
      href?: string;
      target?: string;
      rel?: string;
    }>) => React.createElement('a', { href, target, rel }, children),
    tokens: new Proxy(
      {},
      {
        get: () => '0',
      },
    ),
    makeStyles: () => () => ({
      card: 'card',
      fileList: 'fileList',
      fileItem: 'fileItem',
      form: 'form',
      statusRow: 'statusRow',
      inactive: 'inactive',
    }),
  };
});

import { CreatePRFlowRenderer } from '../components/CreatePRFlow/index.js';

describe('github/CreatePRFlow renderer (#328)', () => {
  it('idle: renders header, file list, and PR title as visible text', () => {
    const html = renderToString(
      <CreatePRFlowRenderer
        props={{
          status: 'idle',
          owner: 'octocat',
          repo: 'kickstart-sample',
          targetBranch: 'main',
          files: ['infra/main.bicep', '.github/workflows/deploy.yml'],
          prTitle: 'feat: kickstart infra and deploy workflow',
          isActive: true,
        }}
      />,
    );

    expect(html).toContain('Create Pull Request');
    expect(html).toContain('octocat/kickstart-sample');
    expect(html).toContain('infra/main.bicep');
    expect(html).toContain('.github/workflows/deploy.yml');
    // Critical: title must be rendered as DOM text (not as an <input value=…>),
    // because the phase-D Playwright spec uses `getByText(...)` to locate it.
    expect(html).toContain('feat: kickstart infra and deploy workflow');
    expect(html).not.toMatch(/<input[^>]*value="feat: kickstart/);
    // targetBranch is surfaced in the form area.
    expect(html).toContain('main');
  });

  it('pushing: shows spinner and status message', () => {
    const html = renderToString(
      <CreatePRFlowRenderer
        props={{
          status: 'pushing',
          owner: 'octocat',
          repo: 'kickstart-sample',
          isActive: true,
        }}
      />,
    );
    expect(html).toContain('Pushing files to branch');
    expect(html).toContain('progressbar');
  });

  it('creating_pr: shows spinner and status message', () => {
    const html = renderToString(
      <CreatePRFlowRenderer
        props={{
          status: 'creating_pr',
          owner: 'octocat',
          repo: 'kickstart-sample',
          isActive: true,
        }}
      />,
    );
    expect(html).toContain('Opening pull request');
    expect(html).toContain('progressbar');
  });

  it('done: renders PR link with target=_blank and rel=noopener noreferrer', () => {
    const html = renderToString(
      <CreatePRFlowRenderer
        props={{
          status: 'done',
          owner: 'octocat',
          repo: 'kickstart-sample',
          prUrl: 'https://github.com/octocat/kickstart-sample/pull/42',
          prNumber: 42,
          isActive: true,
        }}
      />,
    );
    // Strip SSR text-node markers so substring matches behave like
    // Playwright's `getByText` / DOM `textContent` would in the browser.
    const text = html.replace(/<!--[^>]*-->/g, '');
    expect(text).toContain('PR #42');
    expect(html).toContain('href="https://github.com/octocat/kickstart-sample/pull/42"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('View pull request');
  });

  it('error: surfaces the error message to the user', () => {
    const html = renderToString(
      <CreatePRFlowRenderer
        props={{
          status: 'error',
          owner: 'octocat',
          repo: 'kickstart-sample',
          errorMessage: 'Branch protection blocked the push.',
          isActive: true,
        }}
      />,
    );
    expect(html).toContain('Branch protection blocked the push.');
  });

  it('inactive: still renders the card but marks it inactive', () => {
    const html = renderToString(
      <CreatePRFlowRenderer
        props={{
          status: 'idle',
          owner: 'octocat',
          repo: 'kickstart-sample',
          targetBranch: 'main',
          files: ['infra/main.bicep'],
          prTitle: 'feat: deploy',
          isActive: false,
        }}
      />,
    );
    expect(html).toContain('inactive');
    expect(html).toContain('Create Pull Request');
  });
});
