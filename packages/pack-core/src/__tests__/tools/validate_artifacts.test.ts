/**
 * @file validate_artifacts.test.ts
 * @suite Phase C → Phase 1 — core.validate_artifacts tool (#10)
 *
 * Tests dispatcher architecture, input caps, and output capping.
 * Input is `files: {path, content}[]`.
 * Tool dispatches to hadolint for Dockerfiles, skips other file types.
 *
 * @depends #10 (validate_artifacts + hadolint)
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

    it('routes .dockerfile extension to hadolint', async () => {
      const { runHadolint } = await import('../../validators/hadolint.js');
      await invoke([{ path: 'app.dockerfile', content: 'FROM node:20' }]);
      expect(runHadolint).toHaveBeenCalledWith('app.dockerfile', 'FROM node:20');
    });
  });

  // ── Input caps (Zapp security) ──────────────────────────────────────────

  describe('input caps', () => {
    it('rejects more than 20 files via schema', async () => {
      const files = Array.from({ length: 21 }, (_, i) => ({
        path: `file-${i}.yaml`,
        content: 'content',
      }));
      const raw = await invoke(files);
      // SDK catches zod validation errors and returns them as error strings
      expect(String(raw)).toContain('error');
    });

    it('rejects aggregate content exceeding 50MB via schema refinement', async () => {
      // Schema-level refine should catch aggregate size before execute runs
      const bigContent = 'x'.repeat(9 * 1024 * 1024);
      const files = Array.from({ length: 6 }, (_, i) => ({
        path: `file-${i}.yaml`,
        content: bigContent,
      }));
      const raw = await invoke(files);
      // Schema refinement triggers an error before dispatch
      expect(String(raw).toLowerCase()).toContain('error');
    });

    it('rejects aggregate content exceeding 50MB', async () => {
      // Now caught at schema level (refine) — SDK returns error string, not JSON
      const bigContent = 'x'.repeat(9 * 1024 * 1024);
      const files = Array.from({ length: 6 }, (_, i) => ({
        path: `file-${i}.yaml`,
        content: bigContent,
      }));
      const raw = await invoke(files);
      expect(String(raw).toLowerCase()).toContain('error');
    });
  });

  // ── Skipped-state surfacing (Zapp requirement) ──────────────────────────

  describe('skipped-state surfacing', () => {
    it('returns reason string when file type has no validator', async () => {
      const raw = await invoke([{ path: 'unknown.xyz', content: 'data' }]);
      const result = JSON.parse(String(raw));
      expect(result.results[0].status).toBe('skipped');
      expect(result.results[0].reason).toBeDefined();
      expect(typeof result.results[0].reason).toBe('string');
    });
  });

  // ── Retry exhaustion scenario ───────────────────────────────────────────

  describe('retry exhaustion scenario', () => {
    it('returns persistent violations on repeated calls (agent retry simulation)', async () => {
      const { runHadolint } = await import('../../validators/hadolint.js');
      const persistentFailure = {
        path: 'Dockerfile',
        status: 'fail' as const,
        violations: [
          { rule: 'DL3007', severity: 'error' as const, line: 1, message: 'unpinned', fix: 'Pin the base image.' },
        ],
      };
      vi.mocked(runHadolint).mockResolvedValue(persistentFailure);

      // Simulate 3 calls (initial + 2 retries) — each returns the same failure
      for (let attempt = 0; attempt < 3; attempt++) {
        const raw = await invoke([{ path: 'Dockerfile', content: 'FROM ubuntu' }]);
        const result = JSON.parse(String(raw));
        expect(result.results[0].status).toBe('fail');
        expect(result.results[0].violations).toHaveLength(1);
        expect(result.results[0].violations[0].rule).toBe('DL3007');
      }

      expect(runHadolint).toHaveBeenCalledTimes(3);
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
