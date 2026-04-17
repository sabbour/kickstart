import { describe, it, expect } from 'vitest';
import { createPRUserAction } from '../user-actions/create-pr.js';
import { z } from 'zod';

describe('github:create_pr user action', () => {
  const resultSchema = createPRUserAction.resultSchema as z.ZodObject<{
    prNumber: z.ZodNumber;
    prUrl: z.ZodString;
    branch: z.ZodString;
  }>;

  it('has wire name github__create_pr', () => {
    expect(createPRUserAction.wireName).toBe('github__create_pr');
  });

  it('result schema validates a valid result', () => {
    const result = resultSchema.safeParse({
      prNumber: 42,
      prUrl: 'https://github.com/acme/repo/pull/42',
      branch: 'feat/aks-deploy',
    });
    expect(result.success).toBe(true);
  });

  it('result schema rejects a negative prNumber', () => {
    const result = resultSchema.safeParse({
      prNumber: -1,
      prUrl: 'https://github.com/acme/repo/pull/42',
      branch: 'feat/aks-deploy',
    });
    expect(result.success).toBe(false);
  });

  it('result schema requires prUrl', () => {
    const result = resultSchema.safeParse({
      prNumber: 1,
      branch: 'feat/aks-deploy',
    });
    expect(result.success).toBe(false);
  });

  it('result schema requires branch', () => {
    const result = resultSchema.safeParse({
      prNumber: 1,
      prUrl: 'https://github.com/acme/repo/pull/1',
    });
    expect(result.success).toBe(false);
  });

  it('parameters schema enforces prTitle max 255 chars', () => {
    const paramsSchema = createPRUserAction.parameters as z.ZodObject<{
      owner: z.ZodString;
      repo: z.ZodString;
      targetBranch: z.ZodString;
      files: z.ZodArray<z.ZodString>;
      prTitle: z.ZodString;
    }>;
    const longTitle = 'a'.repeat(256);
    const result = paramsSchema.safeParse({
      owner: 'acme',
      repo: 'aks-deploy',
      targetBranch: 'main',
      files: ['k8s/deployment.yaml'],
      prTitle: longTitle,
    });
    expect(result.success).toBe(false);
  });

  it('parameters schema accepts a valid payload', () => {
    const paramsSchema = createPRUserAction.parameters as z.ZodObject<{
      owner: z.ZodString;
      repo: z.ZodString;
      targetBranch: z.ZodString;
      files: z.ZodArray<z.ZodString>;
      prTitle: z.ZodString;
    }>;
    const result = paramsSchema.safeParse({
      owner: 'acme',
      repo: 'aks-deploy',
      targetBranch: 'main',
      files: ['k8s/deployment.yaml', '.github/workflows/deploy.yml'],
      prTitle: 'feat: add AKS deployment',
    });
    expect(result.success).toBe(true);
  });
});
