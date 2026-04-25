import { describe, it, expect } from 'vitest';
import { genKaitoCrd } from '../../tools/gen_kaito_crd.js';

const baseInput = {
  plan: { name: 'my-model' },
  proposed_services: {
    vmSize: 'Standard_NC24ads_A100_v4',
    model: 'llama-2-7b',
  },
};

describe('gen_kaito_crd', () => {
  it('outputPath is exactly "kaito-workspace.yaml"', () => {
    const out = genKaitoCrd(baseInput);
    expect(out.outputPath).toBe('kaito-workspace.yaml');
  });

  it('vmSize from proposed_services is present in output', () => {
    const out = genKaitoCrd(baseInput);
    expect(out.content).toContain('Standard_NC24ads_A100_v4');
  });

  it('model name from proposed_services is present in output', () => {
    const out = genKaitoCrd(baseInput);
    expect(out.content).toContain('llama-2-7b');
  });

  it('plan.name is in the workspace name', () => {
    const out = genKaitoCrd(baseInput);
    expect(out.content).toContain('my-model-workspace');
  });

  it('empty vmSize throws error', () => {
    expect(() => genKaitoCrd({ ...baseInput, proposed_services: { ...baseInput.proposed_services, vmSize: '' } })).toThrow();
  });

  it('empty model throws error', () => {
    expect(() => genKaitoCrd({ ...baseInput, proposed_services: { ...baseInput.proposed_services, model: '' } })).toThrow();
  });
});
