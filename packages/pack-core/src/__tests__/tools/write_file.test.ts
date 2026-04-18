/**
 * @file write_file.test.ts
 * @suite Phase C — core.write_file tool
 *
 * Tests path-confinement guards and successful write + overwrite behaviour
 * against the real implementation.
 *
 * NOTE: The SDK wraps execution errors in a string result rather than
 * rejecting. Error-case tests check the returned string.
 *
 * @depends Phase C of #477 (write_file.ts must exist)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSessionCtx } from './_session-stub.js';

// ── Mock node:fs ─────────────────────────────────────────────────────────────

const _fsStore = new Map<string, string>();

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    realpathSync: vi.fn((p: string) => p),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn((filePath: string, content: string) => {
      _fsStore.set(filePath, content);
    }),
  };
});

import { RunContext } from '@openai/agents';
import { writeFileTool } from '../../tools/write_file.js';
import { resolve } from 'node:path';

// ── Helpers ──────────────────────────────────────────────────────────────────

const WORKSPACE_ROOT = '/workspace/kickstart-test';

const invoke = (path: string, content: string) =>
  writeFileTool.tool.invoke(
    new RunContext({ ...makeSessionCtx(), workspaceRoot: WORKSPACE_ROOT }),
    JSON.stringify({ path, content }),
  );

function storedContent(relativePath: string): string | undefined {
  return _fsStore.get(resolve(WORKSPACE_ROOT, relativePath));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('core.write_file', () => {
  beforeEach(() => {
    _fsStore.clear();
    vi.clearAllMocks();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('valid relative path writes content', () => {
    it('returns a string confirming the write with the path', async () => {
      const result = String(await invoke('src/main.ts', 'const x = 1;'));
      expect(result).toContain('src/main.ts');
    });

    it('stores the content via writeFileSync', async () => {
      await invoke('k8s/deployment.yaml', 'apiVersion: apps/v1');
      expect(storedContent('k8s/deployment.yaml')).toBe('apiVersion: apps/v1');
    });

    it('writes to a nested path without error', async () => {
      const result = await invoke('a/b/c/file.json', '{}');
      expect(result).toBeTruthy();
    });

    it('overwrites an existing file cleanly (second write wins)', async () => {
      await invoke('config.yaml', 'v1');
      await invoke('config.yaml', 'v2');
      expect(storedContent('config.yaml')).toBe('v2');
    });

    it('records the artifact on the session via recordArtifact', async () => {
      const session = { ...makeSessionCtx(), workspaceRoot: WORKSPACE_ROOT };
      await writeFileTool.tool.invoke(
        new RunContext(session),
        JSON.stringify({ path: 'infra/main.bicep', content: 'param env string' }),
      );
      expect(session.artifacts.has('infra/main.bicep')).toBe(true);
    });

    it('calls mkdirSync to create parent directories', async () => {
      const { mkdirSync } = await import('node:fs');
      await invoke('deep/nested/file.ts', '');
      expect(mkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true }),
      );
    });
  });

  // ── Path confinement — traversal ──────────────────────────────────────────

  describe('path traversal → confinement error', () => {
    const traversalPaths = ['../outside', '../../etc/passwd', 'subdir/../../escape'];

    it.each(traversalPaths)(
      'returns an error result for traversal path: %s',
      async (path) => {
        const result = String(await invoke(path, 'x'));
        expect(result).toMatch(/An error occurred|escapes workspace root/i);
      },
    );

    it('does not write to the fs store when traversal is detected', async () => {
      await invoke('../outside.txt', 'leaked');
      expect(_fsStore.size).toBe(0);
    });
  });

  // ── Path confinement — absolute paths ────────────────────────────────────

  describe('absolute path → confinement error', () => {
    it('returns an error result for /etc/passwd', async () => {
      const result = String(await invoke('/etc/passwd', 'x'));
      expect(result).toMatch(/An error occurred|escapes workspace root/i);
    });

    it('returns an error result for any path starting with /', async () => {
      const result = String(await invoke('/home/user/file.txt', 'x'));
      expect(result).toMatch(/An error occurred/i);
    });
  });

  // ── Metadata ──────────────────────────────────────────────────────────────

  describe('ToolContribution shape', () => {
    it('SDK tool name is core_write_file', () => {
      expect(writeFileTool.tool.name).toBe('core_write_file');
    });

    it('ToolContribution logical name is core.write_file', () => {
      expect(writeFileTool.name).toBe('core.write_file');
    });
  });
});
