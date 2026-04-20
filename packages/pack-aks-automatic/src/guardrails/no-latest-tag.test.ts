import { describe, it, expect } from 'vitest';
import { noLatestTagGuardrail } from './no-latest-tag.js';
import type { GuardrailInput } from '@aks-kickstart/harness';

const BASE_MANIFEST = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-app
spec:
  template:
    spec:
      containers:
        - name: app
`;

function makeInput(image: string): GuardrailInput {
  return {
    stage: 'tool',
    toolName: 'core.write_file',
    toolArgs: { content: BASE_MANIFEST + `          image: ${image}\n` },
  };
}

describe('no-latest-tag guardrail', () => {
  it('has correct id and stages', () => {
    expect(noLatestTagGuardrail.id).toBe('aks/no-latest-tag');
    expect(noLatestTagGuardrail.stages).toContain('tool');
  });

  it('blocks image:latest', async () => {
    const result = await noLatestTagGuardrail.evaluate(makeInput('nginx:latest'));
    expect(result.verdict).toBe('block');
    expect(result.reason).toMatch(/latest/i);
  });

  it('passes pinned image with version tag', async () => {
    const result = await noLatestTagGuardrail.evaluate(
      makeInput('myacr.azurecr.io/app:1.2.3')
    );
    expect(result.verdict).toBe('pass');
  });

  it('passes image pinned by digest', async () => {
    const result = await noLatestTagGuardrail.evaluate(
      makeInput('myacr.azurecr.io/app@sha256:abc123def456')
    );
    expect(result.verdict).toBe('pass');
  });

  it('passes non-kubernetes content', async () => {
    const result = await noLatestTagGuardrail.evaluate({
      stage: 'tool',
      toolName: 'core.write_file',
      toolArgs: { content: 'image: nginx:latest in a README' },
    });
    expect(result.verdict).toBe('pass'); // no k8s manifest detected
  });

  it('passes when no toolArgs provided', async () => {
    const result = await noLatestTagGuardrail.evaluate({
      stage: 'tool',
      toolName: 'core.write_file',
    });
    expect(result.verdict).toBe('pass');
  });
});
