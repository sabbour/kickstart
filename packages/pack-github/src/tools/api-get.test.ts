import { describe, it, expect } from 'vitest';
import { validateGithubPath, GITHUB_PATH_ALLOWLIST, FORBIDDEN_SEQ } from './api-get.js';

describe('GitHub path validation', () => {
  // ── Allowlist (valid paths) ───────────────────────────────────────────────

  it('passes a simple filename', () => {
    expect(() => validateGithubPath('README.md')).not.toThrow();
  });

  it('passes a subpath', () => {
    expect(() => validateGithubPath('src/index.ts')).not.toThrow();
  });

  it('passes a .github workflow path', () => {
    expect(() => validateGithubPath('.github/workflows/ci.yml')).not.toThrow();
  });

  it('passes a docs subpath', () => {
    expect(() => validateGithubPath('docs/getting-started.md')).not.toThrow();
  });

  it('passes a k8s manifest path', () => {
    expect(() => validateGithubPath('k8s/deployment.yaml')).not.toThrow();
  });

  it('passes a nested subpath', () => {
    expect(() => validateGithubPath('packages/web/src/App.tsx')).not.toThrow();
  });

  // ── Forbidden sequences (path traversal) ──────────────────────────────────

  it('rejects a path with .. traversal', () => {
    expect(() => validateGithubPath('../../etc/passwd')).toThrow();
  });

  it('rejects %2e%2e encoded traversal', () => {
    expect(() => validateGithubPath('src/%2e%2e/secrets')).toThrow();
  });

  it('rejects %252e double-encoded traversal', () => {
    expect(() => validateGithubPath('src/%252e%252e/secrets')).toThrow();
  });

  it('rejects double-slash', () => {
    expect(() => validateGithubPath('src//secrets')).toThrow();
  });

  it('rejects backslash', () => {
    expect(() => validateGithubPath('src\\secrets')).toThrow();
  });

  // ── GITHUB_PATH_ALLOWLIST unit tests ──────────────────────────────────────

  it('GITHUB_PATH_ALLOWLIST has 7 entries', () => {
    expect(GITHUB_PATH_ALLOWLIST).toHaveLength(7);
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

  it('decodes %2F before checking', () => {
    // %2F is / — after decoding, src%2Findex.ts becomes src/index.ts (valid subpath)
    expect(() => validateGithubPath('src%2Findex.ts')).not.toThrow();
  });
});
