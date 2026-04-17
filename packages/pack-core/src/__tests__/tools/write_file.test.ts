/**
 * @file write_file.test.ts
 * @suite Phase C — core.write_file tool
 *
 * Tests path-confinement guards and successful write + overwrite behaviour.
 *
 * The tool module is stubbed via vi.mock until Fry ships
 * packages/pack-core/src/tools/write_file.ts (Phase C of #477).
 *
 * MIGRATION: once write_file.ts ships, replace the vi.mock block with:
 *   import { writeFileTool } from '../../tools/write_file.js';
 * and delete the mock factory below.
 *
 * @depends Phase C of #477
 * @depends path-confinement policy (no traversal, no absolute paths)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSessionCtx } from './_session-stub.js';

// ── In-memory store shared with read_file (tests are isolated via beforeEach) ─
const _store = new Map<string, string>();

// ── Module stub (remove when Phase C ships) ──────────────────────────────────

vi.mock('../../tools/write_file.js', () => {
  function guardPath(path: string): void {
    if (path.startsWith('/')) {
      throw new Error('CONFINEMENT_ERROR: absolute paths are not allowed');
    }
    if (path.includes('..')) {
      throw new Error('CONFINEMENT_ERROR: path traversal sequences are not allowed');
    }
    if (!path.trim()) {
      throw new Error('CONFINEMENT_ERROR: path must be non-empty');
    }
  }

  return {
    writeFileTool: {
      name: 'core.write_file',
      mcpExposed: false,
      tool: {
        name: 'core.write_file',
        description: 'Write content to a file in the session artifact store.',
        execute: vi.fn(
          async (
            { path, content }: { path: string; content: string },
            _runCtx?: unknown,
          ): Promise<{ ok: boolean; path?: string; error?: string }> => {
            guardPath(path);
            _store.set(path, content);
            return { ok: true, path };
          },
        ),
      },
    },
  };
});

import { writeFileTool } from '../../tools/write_file.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('core.write_file', () => {
  const execute = () => writeFileTool.tool.execute;
  const session = makeSessionCtx();

  beforeEach(() => {
    _store.clear();
    vi.clearAllMocks();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('valid relative path', () => {
    it('returns { ok: true, path } on success', async () => {
      const result = await execute()(
        { path: 'src/main.ts', content: 'const x = 1;' },
        session,
      );

      expect(result.ok).toBe(true);
      expect(result.path).toBe('src/main.ts');
    });

    it('stores the content so it can be read back', async () => {
      await execute()(
        { path: 'k8s/deployment.yaml', content: 'apiVersion: apps/v1' },
        session,
      );

      expect(_store.get('k8s/deployment.yaml')).toBe('apiVersion: apps/v1');
    });

    it('writes to a nested path without error', async () => {
      const result = await execute()(
        { path: 'a/b/c/file.json', content: '{}' },
        session,
      );

      expect(result.ok).toBe(true);
    });

    it('overwrites an existing file cleanly', async () => {
      await execute()({ path: 'config.yaml', content: 'v1' }, session);
      const result = await execute()({ path: 'config.yaml', content: 'v2' }, session);

      expect(result.ok).toBe(true);
      expect(_store.get('config.yaml')).toBe('v2');
    });

    it('can write an empty string as content', async () => {
      const result = await execute()({ path: 'empty.txt', content: '' }, session);

      expect(result.ok).toBe(true);
      expect(_store.get('empty.txt')).toBe('');
    });
  });

  // ── Path confinement — traversal ──────────────────────────────────────────

  describe('path traversal → confinement error', () => {
    const traversalPaths = [
      '../outside',
      '../../etc/passwd',
      'subdir/../../escape',
    ];

    it.each(traversalPaths)(
      'rejects traversal path: %s',
      async (path) => {
        await expect(
          execute()({ path, content: 'x' }, session),
        ).rejects.toThrow(/CONFINEMENT_ERROR/);
      },
    );

    it('does not write to the store when traversal is detected', async () => {
      await expect(
        execute()({ path: '../outside.txt', content: 'leaked' }, session),
      ).rejects.toThrow();

      expect(_store.size).toBe(0);
    });
  });

  // ── Path confinement — absolute paths ────────────────────────────────────

  describe('absolute path → confinement error', () => {
    it('rejects /etc/passwd', async () => {
      await expect(
        execute()({ path: '/etc/passwd', content: 'x' }, session),
      ).rejects.toThrow(/CONFINEMENT_ERROR/);
    });

    it('rejects /tmp/file.txt', async () => {
      await expect(
        execute()({ path: '/tmp/file.txt', content: 'x' }, session),
      ).rejects.toThrow(/CONFINEMENT_ERROR/);
    });
  });

  // ── Metadata ──────────────────────────────────────────────────────────────

  describe('ToolContribution shape', () => {
    it('tool name is core.write_file', () => {
      expect(writeFileTool.tool.name).toBe('core.write_file');
    });

    it('contribution name is core.write_file', () => {
      expect(writeFileTool.name).toBe('core.write_file');
    });
  });
});
