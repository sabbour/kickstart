/**
 * @file read_file.test.ts
 * @suite Phase C — core.read_file tool
 *
 * Tests path-confinement guards, file-not-found error handling, and
 * successful read-back against the real implementation.
 *
 * NOTE: The SDK wraps execution errors in a string result rather than
 * rejecting. Error-case tests check the returned string.
 *
 * @depends Phase C of #477 (read_file.ts must exist)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSessionCtx } from './_session-stub.js';

// ── Mock node:fs ─────────────────────────────────────────────────────────────

const _fsStore = new Map<string, string>();

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: vi.fn((filePath: string) => {
      const content = _fsStore.get(filePath);
      if (content === undefined) {
        throw Object.assign(
          new Error(`ENOENT: no such file or directory, open '${filePath}'`),
          { code: 'ENOENT' },
        );
      }
      return content;
    }),
  };
});

import { RunContext } from '@openai/agents';
import { readFileTool } from '../../tools/read_file.js';
import { resolve } from 'node:path';

// ── Helpers ──────────────────────────────────────────────────────────────────

const WORKSPACE_ROOT = '/workspace/kickstart-test';

const invoke = (path: string) =>
  readFileTool.tool.invoke(
    new RunContext({ ...makeSessionCtx(), workspaceRoot: WORKSPACE_ROOT }),
    JSON.stringify({ path }),
  );

function storeFile(relativePath: string, content: string) {
  _fsStore.set(resolve(WORKSPACE_ROOT, relativePath), content);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('core.read_file', () => {
  beforeEach(() => {
    _fsStore.clear();
    vi.clearAllMocks();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('valid relative path reads file content', () => {
    it('returns the file content as a string', async () => {
      storeFile('src/app.ts', 'export const app = {};');
      const result = await invoke('src/app.ts');
      expect(String(result)).toBe('export const app = {};');
    });

    it('returns content for a file at root of workspace', async () => {
      storeFile('README.md', '# Hello');
      const result = await invoke('README.md');
      expect(String(result)).toBe('# Hello');
    });

    it('returns multi-line content intact', async () => {
      const yaml = 'apiVersion: apps/v1\nkind: Deployment\n';
      storeFile('k8s/deploy.yaml', yaml);
      const result = await invoke('k8s/deploy.yaml');
      expect(String(result)).toBe(yaml);
    });
  });

  // ── Non-existent file ─────────────────────────────────────────────────────

  describe('non-existent file → appropriate error', () => {
    it('returns an error result string for a missing file', async () => {
      const result = String(await invoke('missing.txt'));
      expect(result).toMatch(/An error occurred|cannot read/i);
    });
  });

  // ── Path confinement — traversal ──────────────────────────────────────────

  describe('path traversal → confinement error', () => {
    const traversalPaths = [
      '../secret',
      '../../etc/passwd',
      'subdir/../../../etc/shadow',
    ];

    it.each(traversalPaths)(
      'returns an error result for traversal path: %s',
      async (path) => {
        const result = String(await invoke(path));
        expect(result).toMatch(/An error occurred|escapes workspace root/i);
      },
    );
  });

  // ── Path confinement — absolute paths ────────────────────────────────────

  describe('absolute path → confinement error', () => {
    const absolutePaths = ['/etc/passwd', '/home/user/.ssh/id_rsa'];

    it.each(absolutePaths)(
      'returns an error result for absolute path: %s',
      async (path) => {
        const result = String(await invoke(path));
        expect(result).toMatch(/An error occurred|escapes workspace root/i);
      },
    );
  });

  // ── Metadata ──────────────────────────────────────────────────────────────

  describe('ToolContribution shape', () => {
    it('SDK tool name is core_read_file', () => {
      expect(readFileTool.tool.name).toBe('core_read_file');
    });

    it('ToolContribution logical name is core.read_file', () => {
      expect(readFileTool.name).toBe('core.read_file');
    });
  });
});
