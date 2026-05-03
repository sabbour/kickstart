/**
 * @file update-pr-description.test.ts
 * @suite pack-github — github.update_pr_description tool (#216)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updatePrDescriptionTool,
  executeUpdatePrDescription,
  UpdatePrDescriptionInputSchema,
} from '../tools/update-pr-description.js';

// ── fetch mock helpers ────────────────────────────────────────────────────────

function mockFetch(responses: Array<{ ok: boolean; status?: number; statusText?: string; json?: object }>) {
  const queue = [...responses];
  const fetchMock = vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error('Unexpected extra fetch call');
    return {
      ok: next.ok,
      status: next.status ?? (next.ok ? 200 : 422),
      statusText: next.statusText ?? (next.ok ? 'OK' : 'Unprocessable Entity'),
      json: async () => next.json ?? {},
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock as ReturnType<typeof vi.fn>;
}

beforeEach(() => vi.unstubAllGlobals());

// ── tests ─────────────────────────────────────────────────────────────────────

describe('github.update_pr_description tool', () => {
  it('has name github.update_pr_description', () => {
    expect(updatePrDescriptionTool.name).toBe('github.update_pr_description');
  });
});

describe('executeUpdatePrDescription', () => {
  it('replace mode: PATCHes body without GETting current body', async () => {
    const fetchMock = mockFetch([
      { ok: true, json: { html_url: 'https://github.com/acme/repo/pull/7' } },
    ]);

    const result = await executeUpdatePrDescription(
      { owner: 'acme', repo: 'repo', pullNumber: 7, body: 'New description', appendMode: null },
      'ghp_test',
    );

    expect(result).toEqual({ success: true, url: 'https://github.com/acme/repo/pull/7' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/repos/acme/repo/pulls/7');
    expect(opts.method).toBe('PATCH');
    const sentBody = JSON.parse(opts.body as string) as { body: string };
    expect(sentBody.body).toBe('New description');
  });

  it('append mode: GETs current body then PATCHes combined body', async () => {
    const fetchMock = mockFetch([
      { ok: true, json: { body: 'Existing description' } },
      { ok: true, json: { html_url: 'https://github.com/acme/repo/pull/8' } },
    ]);

    const result = await executeUpdatePrDescription(
      { owner: 'acme', repo: 'repo', pullNumber: 8, body: 'Appended text', appendMode: true },
      'ghp_test',
    );

    expect(result).toEqual({ success: true, url: 'https://github.com/acme/repo/pull/8' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, getOpts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(getOpts.method).toBe('GET');

    const [, patchOpts] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(patchOpts.method).toBe('PATCH');
    const patchBody = JSON.parse(patchOpts.body as string) as { body: string };
    expect(patchBody.body).toBe('Existing description\n\nAppended text');
  });

  it('append mode with empty/null existing body: does not prepend blank lines', async () => {
    const fetchMock = mockFetch([
      { ok: true, json: { body: null } },
      { ok: true, json: { html_url: 'https://github.com/acme/repo/pull/9' } },
    ]);

    await executeUpdatePrDescription(
      { owner: 'acme', repo: 'repo', pullNumber: 9, body: 'First text', appendMode: true },
      'ghp_test',
    );

    const [, patchOpts] = fetchMock.mock.calls[1] as [string, RequestInit];
    const patchBody = JSON.parse(patchOpts.body as string) as { body: string };
    expect(patchBody.body).toBe('First text');
  });

  it('throws when PR not found during PATCH (404)', async () => {
    mockFetch([{ ok: false, status: 404, statusText: 'Not Found' }]);

    await expect(
      executeUpdatePrDescription(
        { owner: 'acme', repo: 'repo', pullNumber: 999, body: 'desc', appendMode: null },
        'ghp_test',
      ),
    ).rejects.toThrow('404');
  });

  it('throws when PR not found during GET in appendMode (404)', async () => {
    mockFetch([{ ok: false, status: 404, statusText: 'Not Found' }]);

    await expect(
      executeUpdatePrDescription(
        { owner: 'acme', repo: 'repo', pullNumber: 999, body: 'desc', appendMode: true },
        'ghp_test',
      ),
    ).rejects.toThrow('404');
  });

  it('URL-encodes owner and repo in the request URL', async () => {
    const fetchMock = mockFetch([
      { ok: true, json: { html_url: 'https://github.com/acme/my-repo/pull/1' } },
    ]);

    await executeUpdatePrDescription(
      { owner: 'acme/org', repo: 'my repo', pullNumber: 1, body: 'desc', appendMode: null },
      'ghp_test',
    );

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(encodeURIComponent('acme/org'));
    expect(url).toContain(encodeURIComponent('my repo'));
    expect(url).not.toContain('acme/org/');
  });
});

// ── Schema validation ──────────────────────────────────────────────────────────

describe('UpdatePrDescriptionInputSchema', () => {
  it('rejects pullNumber of 0', () => {
    const result = UpdatePrDescriptionInputSchema.safeParse({
      owner: 'acme', repo: 'repo', pullNumber: 0, body: 'desc', appendMode: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative pullNumber', () => {
    const result = UpdatePrDescriptionInputSchema.safeParse({
      owner: 'acme', repo: 'repo', pullNumber: -5, body: 'desc', appendMode: null,
    });
    expect(result.success).toBe(false);
  });

  it('accepts pullNumber of 1', () => {
    const result = UpdatePrDescriptionInputSchema.safeParse({
      owner: 'acme', repo: 'repo', pullNumber: 1, body: 'desc', appendMode: null,
    });
    expect(result.success).toBe(true);
  });
});
