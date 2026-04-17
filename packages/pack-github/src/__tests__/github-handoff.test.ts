import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getViewer, createPullRequest, setRepositorySecret } from '../services/github-handoff.js';

describe('github-handoff service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getViewer', () => {
    it('returns viewer summary on 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'octocat', name: 'The Octocat', avatar_url: 'https://github.com/octocat.png' }),
      }));
      const viewer = await getViewer('token123');
      expect(viewer.login).toBe('octocat');
      expect(viewer.name).toBe('The Octocat');
      expect(viewer.avatarUrl).toBe('https://github.com/octocat.png');
    });

    it('throws on non-200 response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      }));
      await expect(getViewer('bad-token')).rejects.toThrow('401');
    });
  });

  describe('createPullRequest', () => {
    it('calls the GitHub API and returns PR number, URL, and branch', async () => {
      const fetchMock = vi.fn()
        // 1. get ref
        .mockResolvedValueOnce({ ok: true, json: async () => ({ object: { sha: 'abc123' } }) })
        // 2. create branch
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        // 3. create blob
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 'blobsha' }) })
        // 4. create tree
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 'treesha' }) })
        // 5. create commit
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 'commitsha' }) })
        // 6. update ref
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        // 7. create PR
        .mockResolvedValueOnce({ ok: true, json: async () => ({ number: 42, html_url: 'https://github.com/acme/repo/pull/42' }) });

      vi.stubGlobal('fetch', fetchMock);

      const result = await createPullRequest('token', {
        repo: { owner: 'acme', name: 'repo' },
        branch: 'feat/deploy',
        base: 'main',
        title: 'feat: deploy',
        files: { 'k8s/deployment.yaml': 'apiVersion: apps/v1' },
      });

      expect(result.prNumber).toBe(42);
      expect(result.prUrl).toBe('https://github.com/acme/repo/pull/42');
      expect(result.branch).toBe('feat/deploy');
    });

    it('throws when getting base branch ref fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
      }));
      await expect(
        createPullRequest('token', {
          repo: { owner: 'acme', name: 'repo' },
          branch: 'feat/deploy',
          base: 'main',
          title: 'feat: deploy',
          files: {},
        }),
      ).rejects.toThrow('404');
    });
  });

  describe('setRepositorySecret', () => {
    it('calls the GitHub secrets API', async () => {
      const fetchMock = vi.fn()
        // 1. get public key
        .mockResolvedValueOnce({ ok: true, json: async () => ({ key_id: 'kid1', key: 'base64key' }) })
        // 2. set secret (204)
        .mockResolvedValueOnce({ ok: true, status: 204 });

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        setRepositorySecret('token', {
          repo: { owner: 'acme', name: 'repo' },
          secretName: 'AZURE_CLIENT_ID',
          secretValue: 'secret-value',
        }),
      ).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws when getting public key fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
      }));
      await expect(
        setRepositorySecret('token', {
          repo: { owner: 'acme', name: 'repo' },
          secretName: 'MY_SECRET',
          secretValue: 'value',
        }),
      ).rejects.toThrow('403');
    });
  });
});
