/**
 * @file inspect_repo.test.ts
 * @suite core.inspect_repo — language/framework detection + security controls
 *
 * Uses LOCAL fixture repos to avoid real network calls for local-path tests.
 * Remote-path tests mock globalThis.fetch to exercise the GitHub REST API path.
 * Tests:
 *  - Python/FastAPI detection (requirements.txt + pyproject.toml)
 *  - Node/Express detection (package.json)
 *  - Go/Gin detection (go.mod)
 *  - URL allowlist rejections (ssh, git, file, non-github, credentialed)
 *  - Dev-mode path containment rejection
 *  - Output redaction (no raw version strings in dep names)
 *  - Remote source: GitHub REST API fetch (mocked fetch)
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

  it('accepts and normalizes a GitHub HTTPS URL with .git suffix', () => {
    const result = validateGitHubUrl('https://github.com/owner/repo.git');
    expect(result).toBe('https://github.com/owner/repo');
  });

  it('accepts and normalizes a GitHub HTTPS URL with .git suffix and trailing slash', () => {
    const result = validateGitHubUrl('https://github.com/owner/repo.git/');
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
        { source: 'local', remoteUrl: null, localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.language).toBe('python');
    });

    it('detects FastAPI framework', async () => {
      const result = await inspectRepo(
        { source: 'local', remoteUrl: null, localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.framework).toBe('fastapi');
    });

    it('detects Python 3.11 runtime from pyproject.toml', async () => {
      const result = await inspectRepo(
        { source: 'local', remoteUrl: null, localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.runtime).toBe('python3.11');
    });

    it('detects postgres database dependency (from sqlalchemy + asyncpg)', async () => {
      const result = await inspectRepo(
        { source: 'local', remoteUrl: null, localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.deps.database).toContain('postgres');
    });

    it('generates db provisioning questionnaire item', async () => {
      const result = await inspectRepo(
        { source: 'local', remoteUrl: null, localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.questionnaire.some((q) => q.id.startsWith('db-provisioning-'))).toBe(true);
    });

    it('reports no Dockerfile (fixture has none)', async () => {
      const result = await inspectRepo(
        { source: 'local', remoteUrl: null, localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.hasDockerfile).toBe(false);
    });

    it('output contains no raw version numbers in dep names', async () => {
      const result = await inspectRepo(
        { source: 'local', remoteUrl: null, localPath: fixturePath },
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
        { source: 'local', remoteUrl: null, localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.language).toBe('javascript');
    });

    it('detects Express framework', async () => {
      const result = await inspectRepo(
        { source: 'local', remoteUrl: null, localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.framework).toBe('express');
    });

    it('detects postgres dependency (from pg)', async () => {
      const result = await inspectRepo(
        { source: 'local', remoteUrl: null, localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.deps.database).toContain('postgres');
    });

    it('detects entrypoint from scripts.start', async () => {
      const result = await inspectRepo(
        { source: 'local', remoteUrl: null, localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.entrypoint).toBe('src/index.js');
    });

    it('output contains no raw version strings in database dep names', async () => {
      const result = await inspectRepo(
        { source: 'local', remoteUrl: null, localPath: fixturePath },
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
        { source: 'local', remoteUrl: null, localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.language).toBe('go');
    });

    it('detects Gin framework', async () => {
      const result = await inspectRepo(
        { source: 'local', remoteUrl: null, localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.framework).toBe('gin');
    });

    it('detects Go 1.21 runtime from go.mod', async () => {
      const result = await inspectRepo(
        { source: 'local', remoteUrl: null, localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.runtime).toBe('go1.21');
    });

    it('detects postgres dep (from lib/pq)', async () => {
      const result = await inspectRepo(
        { source: 'local', remoteUrl: null, localPath: fixturePath },
        FIXTURES_DIR,
      );
      expect(result.deps.database).toContain('postgres');
    });

    it('output dep names are canonical (no version numbers)', async () => {
      const result = await inspectRepo(
        { source: 'local', remoteUrl: null, localPath: fixturePath },
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
      { source: 'local', remoteUrl: null, localPath: join(FIXTURES_DIR, 'gin-sample') },
      FIXTURES_DIR,
    );
    expect(Array.isArray(result.questionnaire)).toBe(true);
  });

  it('always returns hasDockerfile, hasHelmChart, hasGithubActions as booleans', async () => {
    const result = await inspectRepo(
      { source: 'local', remoteUrl: null, localPath: join(FIXTURES_DIR, 'express-sample') },
      FIXTURES_DIR,
    );
    expect(typeof result.hasDockerfile).toBe('boolean');
    expect(typeof result.hasHelmChart).toBe('boolean');
    expect(typeof result.hasGithubActions).toBe('boolean');
  });
});

// ── Remote source: GitHub REST API (mocked fetch) ────────────────────────────

function makeFetchMock(files: Record<string, string>, dirs: Record<string, string[]> = {}) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = url.toString();
    const accept = (init?.headers as Record<string, string> | undefined)?.Accept ?? '';

    // Extract path from URL: /repos/owner/repo/contents/PATH (decode percent-encoding for lookup)
    const match = urlStr.match(/\/repos\/[^/]+\/[^/]+\/contents\/(.*)$/);
    const path = match ? decodeURIComponent(match[1]) : '';

    if (accept === 'application/vnd.github.v3.raw') {
      const content = files[path];
      if (content === undefined) {
        return new Response('Not Found', { status: 404 });
      }
      return new Response(content, { status: 200 });
    }

    // JSON metadata (existence check) or directory listing
    if (path in files) {
      // File existence check — return minimal metadata without body content
      return new Response(JSON.stringify({ name: path.split('/').pop(), type: 'file' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const entries = dirs[path];
    if (entries === undefined) {
      return new Response('Not Found', { status: 404 });
    }
    return new Response(JSON.stringify(entries.map((name) => ({ name, type: 'file' }))), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

describe('inspectRepo — remote source (GitHub REST API)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('detects Python/FastAPI from remote repo via GitHub API', async () => {
    const fetchMock = makeFetchMock({
      'requirements.txt': 'fastapi\nsqlalchemy\nasyncpg\n',
      'pyproject.toml': '[tool.poetry.dependencies]\npython = "^3.11"\n',
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await inspectRepo({
      source: 'remote',
      remoteUrl: 'https://github.com/owner/repo',
      localPath: null,
    });

    expect(result.language).toBe('python');
    expect(result.framework).toBe('fastapi');
    expect(result.runtime).toBe('python3.11');
    expect(result.deps.database).toContain('postgres');
  });

  it('detects Node/Express from remote repo via GitHub API', async () => {
    const packageJson = JSON.stringify({
      dependencies: { express: '^4.18.0', pg: '^8.0.0' },
      scripts: { start: 'node src/index.js' },
    });
    const fetchMock = makeFetchMock({ 'package.json': packageJson });
    vi.stubGlobal('fetch', fetchMock);

    const result = await inspectRepo({
      source: 'remote',
      remoteUrl: 'https://github.com/owner/repo',
      localPath: null,
    });

    expect(result.language).toBe('javascript');
    expect(result.framework).toBe('express');
    expect(result.deps.database).toContain('postgres');
  });

  it('detects Go/Gin from remote repo via GitHub API', async () => {
    const goMod = 'module example.com/app\n\ngo 1.21\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n\tgithub.com/lib/pq v1.10.9\n)\n';
    const fetchMock = makeFetchMock({ 'go.mod': goMod });
    vi.stubGlobal('fetch', fetchMock);

    const result = await inspectRepo({
      source: 'remote',
      remoteUrl: 'https://github.com/owner/repo',
      localPath: null,
    });

    expect(result.language).toBe('go');
    expect(result.framework).toBe('gin');
    expect(result.deps.database).toContain('postgres');
  });

  it('detects Dockerfile presence from remote repo', async () => {
    const fetchMock = makeFetchMock({ 'Dockerfile': 'FROM node:20-alpine\nRUN npm install\n' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await inspectRepo({
      source: 'remote',
      remoteUrl: 'https://github.com/owner/repo',
      localPath: null,
    });

    expect(result.hasDockerfile).toBe(true);
  });

  it('detects GitHub Actions presence from remote repo', async () => {
    const fetchMock = makeFetchMock({}, { '.github/workflows': ['ci.yml', 'deploy.yaml'] });
    vi.stubGlobal('fetch', fetchMock);

    const result = await inspectRepo({
      source: 'remote',
      remoteUrl: 'https://github.com/owner/repo',
      localPath: null,
    });

    expect(result.hasGithubActions).toBe(true);
  });

  it('uses GITHUB_TOKEN from env for authenticated API calls', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'test-token-123');
    const fetchMock = makeFetchMock({ 'package.json': '{"dependencies":{}}' });
    vi.stubGlobal('fetch', fetchMock);

    await inspectRepo({
      source: 'remote',
      remoteUrl: 'https://github.com/owner/repo',
      localPath: null,
    });

    const calls = fetchMock.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const firstHeaders = calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(firstHeaders?.Authorization).toBe('Bearer test-token-123');
  });

  it('throws a clear error when GitHub API returns 500', async () => {
    const fetchMock = vi.fn(async () => new Response('Internal Server Error', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      inspectRepo({ source: 'remote', remoteUrl: 'https://github.com/owner/repo', localPath: null }),
    ).rejects.toThrow(/GitHub API error 500/);
  });

  it('throws when remoteUrl is null for remote source', async () => {
    await expect(
      inspectRepo({ source: 'remote', remoteUrl: null, localPath: null }),
    ).rejects.toThrow(/remoteUrl is required/);
  });

  it('normalizes URLs with .git suffix before API calls', async () => {
    const fetchMock = makeFetchMock({ 'package.json': '{"dependencies":{}}' });
    vi.stubGlobal('fetch', fetchMock);

    // Should not throw — .git suffix is normalized away
    const result = await inspectRepo({
      source: 'remote',
      remoteUrl: 'https://github.com/owner/repo.git',
      localPath: null,
    });
    expect(result).toBeDefined();
  });

  it('returns hasDockerfile false when Dockerfile absent', async () => {
    const fetchMock = makeFetchMock({});
    vi.stubGlobal('fetch', fetchMock);

    const result = await inspectRepo({
      source: 'remote',
      remoteUrl: 'https://github.com/owner/repo',
      localPath: null,
    });

    expect(result.hasDockerfile).toBe(false);
    expect(result.hasGithubActions).toBe(false);
    expect(result.hasHelmChart).toBe(false);
  });
});
