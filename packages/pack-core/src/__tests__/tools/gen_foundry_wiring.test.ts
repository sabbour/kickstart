import { describe, it, expect } from 'vitest';
import { genFoundryWiring } from '../../tools/gen_foundry_wiring.js';

const baseInput = {
  plan: { name: 'my-app' },
  proposed_services: {},
};

describe('gen_foundry_wiring', () => {
  it('outputPath is exactly "foundry-secret.yaml"', () => {
    const out = genFoundryWiring(baseInput);
    expect(out.outputPath).toBe('foundry-secret.yaml');
  });

  it('all values are {{ secrets.* }} placeholders (no real values)', () => {
    const out = genFoundryWiring(baseInput);
    const lines = out.content.split('\n').filter(l => l.includes(':') && l.trim().startsWith('AZURE'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toMatch(/\{\{ secrets\.\w+ \}\}/);
    }
  });

  it('plan.name appears in the secret name', () => {
    const out = genFoundryWiring(baseInput);
    expect(out.content).toContain('my-app-foundry-secrets');
  });

  it('plan name with unsafe chars throws error', () => {
    expect(() => genFoundryWiring({ ...baseInput, plan: { name: 'my app!' } })).toThrow();
  });

  it('AZURE_OPENAI_ENDPOINT placeholder present', () => {
    const out = genFoundryWiring(baseInput);
    expect(out.content).toContain('AZURE_OPENAI_ENDPOINT: "{{ secrets.AZURE_OPENAI_ENDPOINT }}"');
  });

  it('AZURE_OPENAI_KEY placeholder present', () => {
    const out = genFoundryWiring(baseInput);
    expect(out.content).toContain('AZURE_OPENAI_KEY: "{{ secrets.AZURE_OPENAI_KEY }}"');
  });

  it('AZURE_AI_FOUNDRY_PROJECT placeholder present', () => {
    const out = genFoundryWiring(baseInput);
    expect(out.content).toContain('AZURE_AI_FOUNDRY_PROJECT: "{{ secrets.AZURE_AI_FOUNDRY_PROJECT }}"');
  });
});
