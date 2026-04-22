import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  resolveRoleSlug,
  resolveToken,
  resolveTokenWithDiagnostics,
} from '../../../../.squad/scripts/resolve-token.mjs';

const execFileAsync = promisify(execFile);
const scriptPath = new URL('../../../../.squad/scripts/resolve-token.mjs', import.meta.url);
const projectRoot = process.cwd();

describe('resolve-token script', () => {
  it('returns null without throwing for unknown roles', async () => {
    await expect(resolveToken(projectRoot, 'totally-unknown-role')).resolves.toBeNull();
  });

  it('returns a diagnostic reason for unknown roles', async () => {
    await expect(resolveTokenWithDiagnostics(projectRoot, 'totally-unknown-role')).resolves.toMatchObject({
      token: null,
      error: 'No GitHub App mapping configured for role "totally-unknown-role".',
    });
  });

  it('fails closed in required CLI mode', async () => {
    await expect(
      execFileAsync('node', [scriptPath.pathname, '--required', 'totally-unknown-role'], { cwd: projectRoot }),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('No GitHub App mapping configured for role "totally-unknown-role".'),
    });
  });
});

describe('resolve-token role mapping', () => {
  it('consolidates lead-tier reviewers (zapp, nibbler) under the lead role while keeping ralph distinct', async () => {
    expect(resolveRoleSlug(projectRoot, 'lead')).toBe('lead');
    expect(resolveRoleSlug(projectRoot, 'zapp')).toBe('lead');
    expect(resolveRoleSlug(projectRoot, 'nibbler')).toBe('lead');
    expect(resolveRoleSlug(projectRoot, 'ralph')).toBeNull();

    await expect(resolveToken(projectRoot, 'ralph')).resolves.toBeNull();
  });

  it('still resolves the shipped worker roles', () => {
    expect(resolveRoleSlug(projectRoot, 'bender')).toBe('backend');
    expect(resolveRoleSlug(projectRoot, 'fry')).toBe('frontend');
    expect(resolveRoleSlug(projectRoot, 'hermes')).toBe('tester');
  });
});
