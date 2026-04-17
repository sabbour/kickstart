/**
 * @file validate_artifacts.test.ts
 * @suite Phase C — core.validate_artifacts tool
 *
 * Tests the Phase C stub validation contract against the real implementation.
 * The stub always returns { valid: true, errors: [] }.
 * Input field is `files` (not `paths`), with min(1).
 * Tool is invoked via FunctionTool.invoke(runCtx, jsonInput).
 *
 * @depends Phase C of #477 (validate_artifacts.ts must exist)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunContext } from '@openai/agents';
import { validateArtifactsTool } from '../../tools/validate_artifacts.js';
import { makeSessionCtx } from './_session-stub.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('core.validate_artifacts', () => {
  const invoke = (files: string[]) =>
    validateArtifactsTool.tool.invoke(
      new RunContext(makeSessionCtx()),
      JSON.stringify({ files }),
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Phase C stub contract ─────────────────────────────────────────────────

  describe('stub implementation contract', () => {
    it('returns JSON string for a single file path', async () => {
      const raw = await invoke(['k8s/deployment.yaml']);
      expect(typeof String(raw)).toBe('string');
      expect(() => JSON.parse(String(raw))).not.toThrow();
    });

    it('parsed result has valid: true', async () => {
      const raw = await invoke(['k8s/deployment.yaml']);
      const result = JSON.parse(String(raw));
      expect(result.valid).toBe(true);
    });

    it('parsed result has errors: []', async () => {
      const raw = await invoke(['k8s/deployment.yaml']);
      const result = JSON.parse(String(raw));
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts multiple file paths without throwing', async () => {
      await expect(
        invoke(['k8s/deployment.yaml', 'k8s/service.yaml', 'k8s/ingress.yaml']),
      ).resolves.not.toThrow();
    });

    it('returns valid JSON for multiple files', async () => {
      const raw = await invoke(['manifests/deploy.yaml', 'manifests/service.yaml']);
      expect(() => JSON.parse(String(raw))).not.toThrow();
    });
  });

  // ── Future rule tests (todo until real validator ships) ──────────────────

  describe('future rule-based validation (pending real implementation)', () => {
    it.todo('DS001: rejects Deployment without resource limits with severity "error"');
    it.todo('DS001: passes Deployment that has resource limits set');
    it.todo('result shape includes violation details when rules run');
    it.todo('an unknown file extension is handled gracefully');
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
