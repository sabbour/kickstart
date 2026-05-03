import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  deriveResult,
  fetchRepoAccess,
  CheckRepoAccessResult,
} from '../tools/check-repo-access.js';

// ── deriveResult unit tests ───────────────────────────────────────────────────

describe('deriveResult', () => {
  it('admin → hasWriteAccess:true, suggestedAction:create_pr', () => {
    const result = deriveResult('admin');
    expect(result).toEqual<CheckRepoAccessResult>({
      permission: 'admin',
      hasWriteAccess: true,
      suggestedAction: 'create_pr',
    });
  });

  it('write → hasWriteAccess:true, suggestedAction:create_pr', () => {
    const result = deriveResult('write');
    expect(result).toEqual<CheckRepoAccessResult>({
      permission: 'write',
      hasWriteAccess: true,
      suggestedAction: 'create_pr',
    });
  });

  it('read → hasWriteAccess:false, suggestedAction:fork_and_pr', () => {
    const result = deriveResult('read');
    expect(result).toEqual<CheckRepoAccessResult>({
      permission: 'read',
      hasWriteAccess: false,
      suggestedAction: 'fork_and_pr',
    });
  });

  it('none → hasWriteAccess:false, suggestedAction:fork_and_pr', () => {
    const result = deriveResult('none');
    expect(result).toEqual<CheckRepoAccessResult>({
      permission: 'none',
      hasWriteAccess: false,
      suggestedAction: 'fork_and_pr',
    });
  });

  it('unknown string → permission:unknown, hasWriteAccess:false, suggestedAction:fork_and_pr', () => {
    const result = deriveResult('something-unknown');
    expect(result).toEqual<CheckRepoAccessResult>({
      permission: 'unknown',
      hasWriteAccess: false,
      suggestedAction: 'fork_and_pr',
    });
  });
});

// ── fetchRepoAccess: write access granted (normal flow) ───────────────────────

describe('fetchRepoAccess — write access granted', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ permission: 'write' }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns hasWriteAccess:true and create_pr when permission is write', async () => {
    const result = await fetchRepoAccess('contoso', 'iac', 'erin', 'tok_test');
    expect(result).toEqual<CheckRepoAccessResult>({
      permission: 'write',
      hasWriteAccess: true,
      suggestedAction: 'create_pr',
    });
  });
});

// ── fetchRepoAccess: write access denied (fork fallback) ──────────────────────

describe('fetchRepoAccess — write access denied (fork_and_pr fallback)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns hasWriteAccess:false and fork_and_pr when permission is read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ permission: 'read' }),
      }),
    );

    const result = await fetchRepoAccess('contoso', 'iac', 'erin', 'tok_test');
    expect(result).toEqual<CheckRepoAccessResult>({
      permission: 'read',
      hasWriteAccess: false,
      suggestedAction: 'fork_and_pr',
    });
  });

  it('returns fork_and_pr on 404 (not a collaborator)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({}),
      }),
    );

    const result = await fetchRepoAccess('contoso', 'iac', 'erin', 'tok_test');
    expect(result).toEqual<CheckRepoAccessResult>({
      permission: 'none',
      hasWriteAccess: false,
      suggestedAction: 'fork_and_pr',
    });
  });

  it('returns fork_and_pr on 403 (not a collaborator / private repo)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({}),
      }),
    );

    const result = await fetchRepoAccess('contoso', 'iac', 'erin', 'tok_test');
    expect(result).toEqual<CheckRepoAccessResult>({
      permission: 'none',
      hasWriteAccess: false,
      suggestedAction: 'fork_and_pr',
    });
  });
});

// ── fetchRepoAccess: request-review fallback (none permission via API) ─────────

describe('fetchRepoAccess — request-review fallback context', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('none permission → fork_and_pr suggestion (agent then offers fork-or-request-review choice)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ permission: 'none' }),
      }),
    );

    const result = await fetchRepoAccess('contoso', 'iac', 'erin', 'tok_test');

    // Tool surfaces fork_and_pr; the publisher agent then asks user to choose
    // between fork-and-PR or request-review-from-maintainer
    expect(result.hasWriteAccess).toBe(false);
    expect(result.suggestedAction).toBe('fork_and_pr');
  });
});
