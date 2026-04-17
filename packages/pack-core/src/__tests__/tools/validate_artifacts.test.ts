/**
 * @file validate_artifacts.test.ts
 * @suite Phase C — core.validate_artifacts tool
 *
 * Tests the artifact validation tool.  Phase C ships a stub implementation
 * that always returns { valid: true, errors: [] }.  These tests verify that
 * contract and that the tool accepts an array of file paths without throwing.
 *
 * Richer rule-based tests (DS001 resource-limits, etc.) are marked as todo
 * for when the real validator ships in a later phase.
 *
 * The tool module is stubbed via vi.mock until Fry ships
 * packages/pack-core/src/tools/validate_artifacts.ts (Phase C of #477).
 *
 * MIGRATION: once validate_artifacts.ts ships, replace the vi.mock block with:
 *   import { validateArtifactsTool } from '../../tools/validate_artifacts.js';
 * and delete the mock factory below.
 *
 * @depends Phase C of #477
 * @depends SessionCtx.artifacts (Map<string, Artifact>)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSessionCtx } from './_session-stub.js';

// ── Types mirroring the expected Phase C contract ────────────────────────────

export type ValidationError = {
  rule: string;
  path: string;
  severity: 'error' | 'warning';
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

// ── Module stub (remove when Phase C ships) ──────────────────────────────────

vi.mock('../../tools/validate_artifacts.js', () => {
  return {
    validateArtifactsTool: {
      name: 'core.validate_artifacts',
      mcpExposed: false,
      tool: {
        name: 'core.validate_artifacts',
        description: 'Validate session artifact files against known rules.',
        execute: vi.fn(
          async (
            { paths }: { paths: string[] },
            _runCtx?: unknown,
          ): Promise<ValidationResult> => {
            // Phase C stub: accept any array of strings, always pass
            if (!Array.isArray(paths)) {
              throw new TypeError('paths must be an array');
            }
            return { valid: true, errors: [] };
          },
        ),
      },
    },
  };
});

import { validateArtifactsTool } from '../../tools/validate_artifacts.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('core.validate_artifacts', () => {
  const execute = () => validateArtifactsTool.tool.execute;
  const session = makeSessionCtx();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Phase C stub contract ─────────────────────────────────────────────────

  describe('stub implementation contract', () => {
    it('returns { valid: true, errors: [] } for an empty paths array', async () => {
      const result = await execute()({ paths: [] }, session);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('returns { valid: true, errors: [] } for a single file path', async () => {
      const result = await execute()(
        { paths: ['k8s/deployment.yaml'] },
        session,
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('returns { valid: true, errors: [] } for multiple file paths', async () => {
      const result = await execute()(
        {
          paths: [
            'k8s/deployment.yaml',
            'k8s/service.yaml',
            'k8s/ingress.yaml',
          ],
        },
        session,
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('result.errors is an array', async () => {
      const result = await execute()({ paths: ['any/file.yaml'] }, session);

      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('does not throw for typical Kubernetes manifest paths', async () => {
      await expect(
        execute()(
          {
            paths: [
              'manifests/deploy.yaml',
              'manifests/service.yaml',
              'manifests/hpa.yaml',
              'manifests/configmap.yaml',
            ],
          },
          session,
        ),
      ).resolves.not.toThrow();
    });
  });

  // ── Future rule tests (todo until real validator ships) ──────────────────

  describe('future rule-based validation (pending real implementation)', () => {
    it.todo('DS001: rejects Deployment without resource limits with severity "error"');
    it.todo('DS001: passes Deployment that has resource limits set');
    it.todo('result shape includes { violations, passedCount, failedCount } when rules run');
    it.todo('an unknown rule ID in config is ignored gracefully');
  });

  // ── Metadata ──────────────────────────────────────────────────────────────

  describe('ToolContribution shape', () => {
    it('tool name is core.validate_artifacts', () => {
      expect(validateArtifactsTool.tool.name).toBe('core.validate_artifacts');
    });

    it('contribution name is core.validate_artifacts', () => {
      expect(validateArtifactsTool.name).toBe('core.validate_artifacts');
    });
  });
});
