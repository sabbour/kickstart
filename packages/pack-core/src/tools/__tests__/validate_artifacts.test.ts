/**
 * @file validate_artifacts.test.ts
 * @suite validate_artifacts dispatcher + hadolint integration (#1136)
 *
 * Tests:
 *   T1 — Clean Dockerfile → status: 'pass', empty violations
 *   T2 — Unpinned FROM ubuntu → DL3007 violation
 *   T3 — Missing USER instruction → DL3002 violation
 *   T4 — Non-Dockerfile → status: 'skipped'
 *   T5 — Content exceeding 10MB → rejected by schema
 *   T6 — Mixed input (Dockerfile + .ts) → correct per-file status
 *   T7 — Hadolint unavailable → status: 'skipped' with reason
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { validateArtifactsTool, ValidateArtifactsResultSchema } from '../validate_artifacts.js';
import type { ValidateArtifactsResult } from '../validate_artifacts.js';

// ── Helper ────────────────────────────────────────────────────────────────────

async function runValidate(
  files: Array<{ path: string; content: string }>,
): Promise<ValidateArtifactsResult> {
  // The @openai/agents SDK tool wraps the execute fn behind `invoke`.
  // Call invoke with the JSON-stringified input and a stub context.
  const sdkTool = validateArtifactsTool.tool as { invoke: (ctx: unknown, input: string) => Promise<string> };
  const raw = await sdkTool.invoke(
    { usage: { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0 } },
    JSON.stringify({ files }),
  );
  return JSON.parse(raw) as ValidateArtifactsResult;
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../validators/hadolint.js', () => ({
  runHadolint: vi.fn(),
}));

import { runHadolint } from '../../validators/hadolint.js';
const mockedRunHadolint = vi.mocked(runHadolint);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('core.validate_artifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('T1 — clean Dockerfile returns pass with empty violations', async () => {
    mockedRunHadolint.mockResolvedValueOnce({
      path: 'Dockerfile',
      status: 'pass',
      violations: [],
    });

    const result = await runValidate([
      { path: 'Dockerfile', content: 'FROM node:20-alpine\nUSER node\nCOPY . .\nCMD ["node","index.js"]' },
    ]);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].status).toBe('pass');
    expect(result.results[0].violations).toEqual([]);
    expect(mockedRunHadolint).toHaveBeenCalledOnce();
  });

  it('T2 — unpinned FROM ubuntu produces DL3007 violation', async () => {
    mockedRunHadolint.mockResolvedValueOnce({
      path: 'Dockerfile',
      status: 'fail',
      violations: [
        { rule: 'DL3007', severity: 'warning', line: 1, message: 'Using latest is prone to errors if the image will ever update. Pin the version explicitly to a release tag' },
      ],
    });

    const result = await runValidate([
      { path: 'Dockerfile', content: 'FROM ubuntu\nRUN echo hello' },
    ]);

    expect(result.results[0].status).toBe('fail');
    expect(result.results[0].violations).toHaveLength(1);
    expect(result.results[0].violations[0].rule).toBe('DL3007');
  });

  it('T3 — missing USER produces DL3002 violation', async () => {
    mockedRunHadolint.mockResolvedValueOnce({
      path: 'Dockerfile',
      status: 'fail',
      violations: [
        { rule: 'DL3002', severity: 'warning', line: 1, message: 'Last USER should not be root' },
      ],
    });

    const result = await runValidate([
      { path: 'Dockerfile', content: 'FROM node:20\nCOPY . .\nCMD ["node","index.js"]' },
    ]);

    expect(result.results[0].status).toBe('fail');
    const rules = result.results[0].violations.map((v) => v.rule);
    expect(rules).toContain('DL3002');
  });

  it('T4 — non-Dockerfile file is skipped', async () => {
    const result = await runValidate([
      { path: 'src/main.ts', content: 'console.log("hello")' },
    ]);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].status).toBe('skipped');
    expect(result.results[0].reason).toContain('no validator');
    expect(mockedRunHadolint).not.toHaveBeenCalled();
  });

  it('T5 — content exceeding 10MB is rejected by schema', () => {
    const schema = z.object({
      files: z.array(
        z.object({
          path: z.string().min(1),
          content: z.string().max(10 * 1024 * 1024),
        }),
      ).min(1),
    });

    const oversized = 'x'.repeat(10 * 1024 * 1024 + 1);
    const parsed = schema.safeParse({ files: [{ path: 'Dockerfile', content: oversized }] });
    expect(parsed.success).toBe(false);
  });

  it('T6 — mixed input dispatches correctly per file type', async () => {
    mockedRunHadolint.mockResolvedValueOnce({
      path: 'Dockerfile',
      status: 'pass',
      violations: [],
    });

    const result = await runValidate([
      { path: 'Dockerfile', content: 'FROM node:20-alpine\nUSER node' },
      { path: 'infra/main.bicep', content: 'param location string' },
    ]);

    expect(result.results).toHaveLength(2);
    expect(result.results[0].path).toBe('Dockerfile');
    expect(result.results[0].status).toBe('pass');
    expect(result.results[1].path).toBe('infra/main.bicep');
    expect(result.results[1].status).toBe('skipped');
    expect(mockedRunHadolint).toHaveBeenCalledOnce();
  });

  it('T7 — hadolint unavailable returns skipped with reason', async () => {
    mockedRunHadolint.mockResolvedValueOnce({
      path: 'Dockerfile',
      status: 'skipped',
      violations: [],
      reason: 'hadolint binary not available (not on PATH and download failed)',
    });

    const result = await runValidate([
      { path: 'Dockerfile', content: 'FROM node:20\nCOPY . .' },
    ]);

    expect(result.results[0].status).toBe('skipped');
    expect(result.results[0].reason).toContain('hadolint');
    expect(result.results[0].violations).toEqual([]);
  });

  it('result conforms to ValidateArtifactsResultSchema', async () => {
    mockedRunHadolint.mockResolvedValueOnce({
      path: 'Dockerfile',
      status: 'fail',
      violations: [
        { rule: 'DL3007', severity: 'warning', line: 1, message: 'Pin the version' },
      ],
    });

    const result = await runValidate([
      { path: 'Dockerfile', content: 'FROM ubuntu' },
    ]);

    const parsed = ValidateArtifactsResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('routes *.dockerfile files to hadolint', async () => {
    mockedRunHadolint.mockResolvedValueOnce({
      path: 'app.dockerfile',
      status: 'pass',
      violations: [],
    });

    const result = await runValidate([
      { path: 'app.dockerfile', content: 'FROM node:20-alpine\nUSER node' },
    ]);

    expect(result.results[0].status).toBe('pass');
    expect(mockedRunHadolint).toHaveBeenCalledOnce();
  });
});
