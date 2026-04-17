/**
 * @file read_file.test.ts
 * @suite Phase C — core.read_file tool
 *
 * Tests path-confinement guards, file-not-found error handling, and
 * successful read-back of previously written content.
 *
 * The tool module is stubbed via vi.mock until Fry ships
 * packages/pack-core/src/tools/read_file.ts (Phase C of #477).
 *
 * MIGRATION: once read_file.ts ships, replace the vi.mock block with:
 *   import { readFileTool } from '../../tools/read_file.js';
 * and delete the mock factory below.
 *
 * @depends Phase C of #477
 * @depends path-confinement policy (no traversal, no absolute paths)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSessionCtx } from './_session-stub.js';

// ── In-memory file store shared between read/write in tests ──────────────────
const _store = new Map<string, string>();

// ── Module stub (remove when Phase C ships) ──────────────────────────────────

vi.mock('../../tools/read_file.js', () => {
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
    readFileTool: {
      name: 'core.read_file',
      mcpExposed: false,
      tool: {
        name: 'core.read_file',
        description: 'Read the contents of a file from the session artifact store.',
        execute: vi.fn(
          async (
            { path }: { path: string },
            _runCtx?: unknown,
          ): Promise<{ ok: boolean; content?: string; error?: string }> => {
            guardPath(path);
            const content = _store.get(path);
            if (content === undefined) {
              return { ok: false, error: 'NOT_FOUND' };
            }
            return { ok: true, content };
          },
        ),
      },
    },
  };
});

import { readFileTool } from '../../tools/read_file.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('core.read_file', () => {
  const execute = () => readFileTool.tool.execute;
  const session = makeSessionCtx();

  beforeEach(() => {
    _store.clear();
    vi.clearAllMocks();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('valid relative path', () => {
    it('returns { ok: true, content } when the file exists', async () => {
      _store.set('src/app.ts', 'export const app = {};');

      const result = await execute()({ path: 'src/app.ts' }, session);

      expect(result.ok).toBe(true);
      expect(result.content).toBe('export const app = {};');
    });

    it('returns { ok: true, content } for a file at the root of the store', async () => {
      _store.set('README.md', '# Hello');

      const result = await execute()({ path: 'README.md' }, session);

      expect(result.ok).toBe(true);
      expect(result.content).toBe('# Hello');
    });

    it('returns { ok: false, error: "NOT_FOUND" } when path does not exist', async () => {
      const result = await execute()({ path: 'missing.txt' }, session);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('NOT_FOUND');
    });
  });

  // ── Path confinement — traversal ──────────────────────────────────────────

  describe('path traversal → confinement error', () => {
    const traversalPaths = [
      '../secret',
      '../../etc/passwd',
      'subdir/../../../etc/shadow',
      'a/b/../../../../../../etc/hosts',
    ];

    it.each(traversalPaths)(
      'rejects traversal path: %s',
      async (path) => {
        await expect(
          execute()({ path }, session),
        ).rejects.toThrow(/CONFINEMENT_ERROR/);
      },
    );
  });

  // ── Path confinement — absolute paths ────────────────────────────────────

  describe('absolute path → confinement error', () => {
    const absolutePaths = [
      '/etc/passwd',
      '/home/user/.ssh/id_rsa',
      '/tmp/secret',
    ];

    it.each(absolutePaths)(
      'rejects absolute path: %s',
      async (path) => {
        await expect(
          execute()({ path }, session),
        ).rejects.toThrow(/CONFINEMENT_ERROR/);
      },
    );
  });

  // ── Metadata ──────────────────────────────────────────────────────────────

  describe('ToolContribution shape', () => {
    it('tool name is core.read_file', () => {
      expect(readFileTool.tool.name).toBe('core.read_file');
    });

    it('contribution name is core.read_file', () => {
      expect(readFileTool.name).toBe('core.read_file');
    });
  });
});
