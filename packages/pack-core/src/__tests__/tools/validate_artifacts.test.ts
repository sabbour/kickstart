/**
 * @file validate_artifacts.test.ts
 * @suite Phase C → Phase 1 — core.validate_artifacts tool (#1136)
 *
 * Updated from the stub test to match the new dispatcher architecture.
 * Input is now `files: {path, content}[]` (not `files: string[]`).
 * Tool dispatches to hadolint for Dockerfiles, skips other file types.
 *
 * @depends #1136 (validate_artifacts rewrite)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunContext } from '@openai/agents';
import { validateArtifactsTool } from '../../tools/validate_artifacts.js';
import { makeSessionCtx } from './_session-stub.js';

// Mock hadolint so these tests don't need the binary
vi.mock('../../validators/hadolint.js', () => ({
  runHadolint: vi.fn().mockResolvedValue({
    path: 'Dockerfile',
    status: 'pass',
    violations: [],
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('core.validate_artifacts', () => {
  const invoke = (files: Array<{ path: string; content: string }>) =>
    validateArtifactsTool.tool.invoke(
      new RunContext(makeSessionCtx()),
      JSON.stringify({ files }),
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Dispatcher contract ──────────────────────────────────────────────────

  describe('dispatcher contract', () => {
    it('returns JSON string for a single file', async () => {
      const raw = await invoke([{ path: 'k8s/deployment.yaml', content: 'apiVersion: apps/v1' }]);
      expect(typeof String(raw)).toBe('string');
      expect(() => JSON.parse(String(raw))).not.toThrow();
    });

    it('parsed result has results array', async () => {
      const raw = await invoke([{ path: 'k8s/deployment.yaml', content: 'apiVersion: apps/v1' }]);
      const result = JSON.parse(String(raw));
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results).toHaveLength(1);
    });

    it('non-Dockerfile is skipped', async () => {
      const raw = await invoke([{ path: 'k8s/deployment.yaml', content: 'apiVersion: apps/v1' }]);
      const result = JSON.parse(String(raw));
      expect(result.results[0].status).toBe('skipped');
    });

    it('accepts multiple files without throwing', async () => {
      await expect(
        invoke([
          { path: 'k8s/deployment.yaml', content: 'apiVersion: apps/v1' },
          { path: 'k8s/service.yaml', content: 'kind: Service' },
          { path: 'Dockerfile', content: 'FROM node:20' },
        ]),
      ).resolves.not.toThrow();
    });

    it('returns valid JSON for multiple files', async () => {
      const raw = await invoke([
        { path: 'manifests/deploy.yaml', content: 'kind: Deployment' },
        { path: 'Dockerfile', content: 'FROM node:20' },
      ]);
      expect(() => JSON.parse(String(raw))).not.toThrow();
    });
  });

  // ── Metadata ──────────────────────────────────────────────────────────────

  describe('ToolContribution shape', () => {
    it('SDK tool name is core_validate_artifacts', () => {
      expect(validateArtifactsTool.tool.name).toBe('core_validate_artifacts');
    });

    it('ToolContribution logical name is core.validate_artifacts', () => {
      expect(validateArtifactsTool.name).toBe('core.validate_artifacts');
    });
  });
});
