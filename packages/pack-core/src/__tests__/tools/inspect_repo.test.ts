/**
 * @file inspect_repo.test.ts
 * @suite core.inspect_repo — language/framework detection + security controls
 *
 * Uses LOCAL fixture repos to avoid real git clones.
 * Tests:
 *  - Python/FastAPI detection (requirements.txt + pyproject.toml)
 *  - Node/Express detection (package.json)
 *  - Go/Gin detection (go.mod)
 *  - URL allowlist rejections (ssh, git, file, non-github, credentialed)
 *  - Dev-mode path containment rejection
 *  - Output redaction (no raw version strings in dep names)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateGitHubUrl,
  validateLocalPath,
  inspectRepo,
  type InspectRepoOutput,
} from '../../tools/inspect_repo.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_DIR = join(__dirname, '../fixtures');

// ── URL allowlist tests ───────────────────────────────────────────────────────

describe('validateGitHubUrl', () => {
  it('accepts a plain GitHub HTTPS URL', () => {
    const result = validateGitHubUrl('https://github.com/owner/repo');
    expect(result).toBe('https://github.com/owner/repo');
  });

  it('accepts a GitHub HTTPS URL with trailing slash', () => {
    const result = validateGitHubUrl('https://github.com/owner/repo/');
    expect(result).toBe('https://github.com/owner/repo');
  });

  it('rejects SSH URLs', () => {
    expect(() => validateGitHubUrl('git@github.com:owner/repo.git')).toThrow(
      /only GitHub HTTPS URLs/,
    );
  });

  it('rejects git:// URLs', () => {
    expect(() => validateGitHubUrl('git://github.com/owner/repo')).toThrow(
      /only GitHub HTTPS URLs/,
    );
  });

  it('rejects file:// URLs', () => {
    expect(() => validateGitHubUrl('file:///tmp/repo')).toThrow(/only GitHub HTTPS URLs/);
  });

  it('rejects non-GitHub HTTPS URLs', () => {
    expect(() => validateGitHubUrl('https://gitlab.com/owner/repo')).toThrow(
      /only GitHub HTTPS URLs/,
    );
  });

  it('rejects credentialed URLs (user:pass@github.com)', () => {
    expect(() => validateGitHubUrl('https://user:pass@github.com/owner/repo')).toThrow(
      /only GitHub HTTPS URLs/,
    );
  });

  it('rejects URLs with query strings', () => {
    expect(() => validateGitHubUrl('https://github.com/owner/repo?ref=main')).toThrow(
      /only GitHub HTTPS URLs/,
    );
  });

  it('rejects deep paths (not just owner/repo)', () => {
    expect(() => validateGitHubUrl('https://github.com/owner/repo/tree/main')).toThrow(
      /only GitHub HTTPS URLs/,
    );
  });

  it('rejects empty string', () => {
    expect(() => validateGitHubUrl('')).toThrow(/only GitHub HTTPS URLs/);
  });
});

// ── Dev-mode path containment tests ──────────────────────────────────────────

describe('validateLocalPath', () => {
  const WORKSPACE = '/workspace/my-app';

  beforeEach(() => {
    vi.stubEnv('IS_DEV_MODE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts a path inside the workspace', () => {
    const result = validateLocalPath('/workspace/my-app/subdir', WORKSPACE);
    expect(result).toBe('/workspace/my-app/subdir');
  });

  it('rejects a path outside the workspace root', () => {
    expect(() => validateLocalPath('/etc/passwd', WORKSPACE)).toThrow(
      /resolves outside workspace root/,
    );
  });

  it('rejects path traversal attempts', () => {
    expect(() =>
      validateLocalPath('/workspace/my-app/../../../etc/passwd', WORKSPACE),
    ).toThrow(/resolves outside workspace root/);
  });

  it('rejects when IS_DEV_MODE is not set', () => {
    vi.unstubAllEnvs();
    expect(() => validateLocalPath('/workspace/my-app/subdir', WORKSPACE)).toThrow(
      /IS_DEV_MODE=true/,
    );
  });

  it('rejects when IS_DEV_MODE=false', () => {
    vi.stubEnv('IS_DEV_MODE', 'false');
    expect(() => validateLocalPath('/workspace/my-app/subdir', WORKSPACE)).toThrow(
      /IS_DEV_MODE=true/,
    );
  });
});

// ── Fixture-based detection tests ─────────────────────────────────────────────

describe('inspectRepo — local fixtures', () => {
  beforeEach(() => {
    vi.stubEnv('IS_DEV_MODE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Python / FastAPI fixture', () => {
    const fixturePath = join(FIXTURES_DIR, 'fastapi-sample');

    it('detects Python language', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.language).toBe('python');
    });

    it('detects FastAPI framework', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.framework).toBe('fastapi');
    });

    it('detects Python 3.11 runtime from pyproject.toml', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.runtime).toBe('python3.11');
    });

    it('detects postgres database dependency (from sqlalchemy + asyncpg)', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.deps.database).toContain('postgres');
    });

    it('generates db provisioning questionnaire item', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.questionnaire.some((q) => q.id.startsWith('db-provisioning-'))).toBe(true);
    });

    it('reports no Dockerfile (fixture has none)', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.hasDockerfile).toBe(false);
    });

    it('output contains no raw version numbers in dep names', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      const depNames = result.deps.database ?? [];
      for (const dep of depNames) {
        expect(dep).not.toMatch(/\d+\.\d+/);
      }
    });
  });

  describe('Node / Express fixture', () => {
    const fixturePath = join(FIXTURES_DIR, 'express-sample');

    it('detects javascript language', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.language).toBe('javascript');
    });

    it('detects Express framework', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.framework).toBe('express');
    });

    it('detects postgres dependency (from pg)', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.deps.database).toContain('postgres');
    });

    it('detects entrypoint from scripts.start', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.entrypoint).toBe('src/index.js');
    });

    it('output contains no raw version strings in database dep names', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      for (const dep of result.deps.database ?? []) {
        expect(dep).not.toMatch(/\d+\.\d+/);
        expect(dep).not.toMatch(/https?:\/\//);
      }
    });
  });

  describe('Go / Gin fixture', () => {
    const fixturePath = join(FIXTURES_DIR, 'gin-sample');

    it('detects Go language', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.language).toBe('go');
    });

    it('detects Gin framework', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.framework).toBe('gin');
    });

    it('detects Go 1.21 runtime from go.mod', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.runtime).toBe('go1.21');
    });

    it('detects postgres dep (from lib/pq)', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.deps.database).toContain('postgres');
    });

    it('output dep names are canonical (no version numbers)', async () => {
      const result = await inspectRepo(
        { source: 'local', localPath: fixturePath },
        FIXTURES_DIR,
      );
      for (const dep of result.deps.database ?? []) {
        expect(dep).not.toMatch(/\d+\.\d+/);
        expect(dep).not.toMatch(/https?:\/\//);
        expect(dep).not.toMatch(/github\.com/);
      }
    });
  });
});

// ── Output shape tests ────────────────────────────────────────────────────────

describe('inspectRepo output shape', () => {
  beforeEach(() => {
    vi.stubEnv('IS_DEV_MODE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('always returns questionnaire as an array', async () => {
    const result: InspectRepoOutput = await inspectRepo(
      { source: 'local', localPath: join(FIXTURES_DIR, 'gin-sample') },
      FIXTURES_DIR,
    );
    expect(Array.isArray(result.questionnaire)).toBe(true);
  });

  it('always returns hasDockerfile, hasHelmChart, hasGithubActions as booleans', async () => {
    const result = await inspectRepo(
      { source: 'local', localPath: join(FIXTURES_DIR, 'express-sample') },
      FIXTURES_DIR,
    );
    expect(typeof result.hasDockerfile).toBe('boolean');
    expect(typeof result.hasHelmChart).toBe('boolean');
    expect(typeof result.hasGithubActions).toBe('boolean');
  });
});
