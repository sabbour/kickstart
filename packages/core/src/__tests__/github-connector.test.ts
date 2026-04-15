import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubConnector } from '../connectors/GitHubConnector.js';

describe('GitHubConnector secure ship path', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('posts commit and PR writes to the server-owned GitHub endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      pullRequest: {
        number: 42,
        html_url: 'https://github.com/sabbour/demo-app/pull/42',
        title: 'feat: add artifacts',
        state: 'open',
        head: { ref: 'feature/kickstart', sha: 'commit-new' },
        base: { ref: 'main' },
      },
      commitSha: 'commit-new',
      committedFilesCount: 1,
      headBranch: 'feature/kickstart',
      baseBranch: 'main',
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }));

    const connector = new GitHubConnector({
      auth: { kind: 'oauth2', scopes: ['read:user'] },
      serverBaseUrl: '/api/github',
    });

    const result = await connector.commitFilesAndCreatePullRequest({
      owner: 'sabbour',
      repo: 'demo-app',
      title: 'feat: add artifacts',
      head: 'feature/kickstart',
      base: 'main',
      body: 'Please review.',
      commitMessage: 'feat: add artifacts',
      files: [{ path: 'Dockerfile', content: 'FROM node:20' }],
    });

    expect(result).toMatchObject({
      commitSha: 'commit-new',
      committedFilesCount: 1,
      headBranch: 'feature/kickstart',
      baseBranch: 'main',
      pullRequest: {
        number: 42,
        html_url: 'https://github.com/sabbour/demo-app/pull/42',
      },
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/github/pulls', expect.objectContaining({
      method: 'POST',
      redirect: 'manual',
    }));

    const init = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('authorization')).toBeNull();
    expect(JSON.parse(String(init?.body))).toMatchObject({
      owner: 'sabbour',
      repo: 'demo-app',
      head: 'feature/kickstart',
      base: 'main',
      files: [{ path: 'Dockerfile', content: 'FROM node:20' }],
    });
  });

  it('fails closed instead of simulating pull request creation in stub mode', async () => {
    const connector = new GitHubConnector({
      auth: { kind: 'oauth2', scopes: ['read:user'] },
      allowStubMode: true,
    });

    await expect(
      connector.createPullRequest(
        'sabbour',
        'demo-app',
        'feat: add artifacts',
        'feature/kickstart',
        'main',
      ),
    ).rejects.toMatchObject({
      name: 'ConnectorError',
      code: 'STUB_MODE_DISABLED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
