import { describe, it, expect } from 'vitest';
import { validateGithubPath, GITHUB_API_PATH_ALLOWLIST, FORBIDDEN_SEQ } from './api-get.js';

describe('GitHub API path validation', () => {
  // ── Allowlist: one passing example per pattern ────────────────────────────

  it('passes /repos/owner/repo', () => {
    expect(() => validateGithubPath('/repos/owner/repo')).not.toThrow();
  });

  it('passes /repos/owner/repo/contents/README.md', () => {
    expect(() => validateGithubPath('/repos/owner/repo/contents/README.md')).not.toThrow();
  });

  it('passes /orgs/my-org', () => {
    expect(() => validateGithubPath('/orgs/my-org')).not.toThrow();
  });

  it('passes /orgs/my-org/repos', () => {
    expect(() => validateGithubPath('/orgs/my-org/repos')).not.toThrow();
  });

  it('passes /user', () => {
    expect(() => validateGithubPath('/user')).not.toThrow();
  });

  it('passes /user/repos', () => {
    expect(() => validateGithubPath('/user/repos')).not.toThrow();
  });

  it('passes /users/octocat', () => {
    expect(() => validateGithubPath('/users/octocat')).not.toThrow();
  });

  it('passes /users/octocat/repos', () => {
    expect(() => validateGithubPath('/users/octocat/repos')).not.toThrow();
  });

  it('passes /search/repositories', () => {
    expect(() => validateGithubPath('/search/repositories')).not.toThrow();
  });

  it('passes /search/code', () => {
    expect(() => validateGithubPath('/search/code')).not.toThrow();
  });

  it('passes /search/issues', () => {
    expect(() => validateGithubPath('/search/issues')).not.toThrow();
  });

  it('passes /search/users', () => {
    expect(() => validateGithubPath('/search/users')).not.toThrow();
  });

  it('passes /gists', () => {
    expect(() => validateGithubPath('/gists')).not.toThrow();
  });

  it('passes /gists/abc123', () => {
    expect(() => validateGithubPath('/gists/abc123')).not.toThrow();
  });

  it('passes /rate_limit', () => {
    expect(() => validateGithubPath('/rate_limit')).not.toThrow();
  });

  // ── SSRF / not-in-allowlist rejection ─────────────────────────────────────

  it('rejects @evil.com/path — SSRF vector', () => {
    expect(() => validateGithubPath('@evil.com/path')).toThrow('not in allowlist');
  });

  it('rejects absolute URL', () => {
    expect(() => validateGithubPath('https://evil.com/hack')).toThrow();
  });

  it('rejects file-system path README.md (no leading slash)', () => {
    expect(() => validateGithubPath('README.md')).toThrow();
  });

  it('rejects unknown top-level path /unknown/segment', () => {
    expect(() => validateGithubPath('/unknown/segment')).toThrow();
  });

  // ── Forbidden sequences (path traversal) ──────────────────────────────────

  it('rejects .. traversal in path', () => {
    expect(() => validateGithubPath('/repos/owner/repo/../../etc/passwd')).toThrow();
  });

  it('rejects %2e%2e encoded traversal', () => {
    expect(() => validateGithubPath('/repos/owner/repo/%2e%2e/secrets')).toThrow();
  });

  it('rejects %252e double-encoded traversal', () => {
    expect(() => validateGithubPath('/repos/owner/repo/%252e%252e/secrets')).toThrow();
  });

  it('rejects double-slash', () => {
    expect(() => validateGithubPath('/repos/owner//repo')).toThrow();
  });

  it('rejects backslash', () => {
    expect(() => validateGithubPath('/repos/owner\\repo')).toThrow();
  });

  // ── GITHUB_API_PATH_ALLOWLIST unit tests ──────────────────────────────────

  it('GITHUB_API_PATH_ALLOWLIST has 7 entries', () => {
    expect(GITHUB_API_PATH_ALLOWLIST).toHaveLength(7);
  });

  // ── FORBIDDEN_SEQ unit tests ──────────────────────────────────────────────

  it('FORBIDDEN_SEQ matches ..', () => {
    expect(FORBIDDEN_SEQ.test('..')).toBe(true);
  });

  it('FORBIDDEN_SEQ matches %2e%2e case-insensitively', () => {
    expect(FORBIDDEN_SEQ.test('%2E%2E')).toBe(true);
  });

  it('FORBIDDEN_SEQ matches //', () => {
    expect(FORBIDDEN_SEQ.test('//')).toBe(true);
  });

  it('FORBIDDEN_SEQ matches backslash', () => {
    expect(FORBIDDEN_SEQ.test('\\')).toBe(true);
  });

  // ── decodeURIComponent applied before check ────────────────────────────────

  it('decodes %2F before checking (valid path after decode)', () => {
    // /repos%2Fowner%2Frepo decodes to /repos/owner/repo — valid
    expect(() => validateGithubPath('/repos%2Fowner%2Frepo')).not.toThrow();
  });
});
