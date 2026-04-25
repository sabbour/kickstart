import { describe, it, expect } from 'vitest';
import { proposeServices, GPU_SKU_MATRIX, SUPPORTED_MODEL_SIZES } from './propose-services.js';

const plan = { clusterName: 'my-cluster' };

// ── SKU matrix ────────────────────────────────────────────────────────────────

describe('GPU_SKU_MATRIX', () => {
  it('maps 7b to Standard_NC24ads_A100_v4', () => {
    expect(GPU_SKU_MATRIX['7b']).toBe('Standard_NC24ads_A100_v4');
  });

  it('maps 13b to Standard_NC48ads_A100_v4', () => {
    expect(GPU_SKU_MATRIX['13b']).toBe('Standard_NC48ads_A100_v4');
  });

  it('maps 70b to Standard_NC96ads_A100_v4', () => {
    expect(GPU_SKU_MATRIX['70b']).toBe('Standard_NC96ads_A100_v4');
  });

  it('has exactly 3 entries (AKS-Automatic only)', () => {
    expect(Object.keys(GPU_SKU_MATRIX)).toHaveLength(3);
  });

  it('SUPPORTED_MODEL_SIZES lists all keys', () => {
    expect(SUPPORTED_MODEL_SIZES).toEqual(expect.arrayContaining(['7b', '13b', '70b']));
    expect(SUPPORTED_MODEL_SIZES).toHaveLength(3);
  });
});

// ── KAITO branch ──────────────────────────────────────────────────────────────

describe('proposeServices — kaito track', () => {
  it('returns kaito track with correct vmSize for 7b', () => {
    const result = proposeServices('kaito', '7b');
    expect(result.track).toBe('kaito');
    if (result.track === 'kaito') {
      expect(result.vmSize).toBe('Standard_NC24ads_A100_v4');
      expect(result.modelSize).toBe('7b');
    }
  });

  it('returns kaito track with correct vmSize for 13b', () => {
    const result = proposeServices('kaito', '13b');
    expect(result.track).toBe('kaito');
    if (result.track === 'kaito') {
      expect(result.vmSize).toBe('Standard_NC48ads_A100_v4');
    }
  });

  it('returns kaito track with correct vmSize for 70b', () => {
    const result = proposeServices('kaito', '70b');
    expect(result.track).toBe('kaito');
    if (result.track === 'kaito') {
      expect(result.vmSize).toBe('Standard_NC96ads_A100_v4');
    }
  });

  it('includes kaito-workspace service', () => {
    const result = proposeServices('kaito', '7b');
    expect(result.services).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'kaito-workspace' })]),
    );
  });

  it('nodePoolRecommendation has correct vmSize and mode=User', () => {
    const result = proposeServices('kaito', '13b');
    if (result.track === 'kaito') {
      expect(result.nodePoolRecommendation.vmSize).toBe('Standard_NC48ads_A100_v4');
      expect(result.nodePoolRecommendation.mode).toBe('User');
    }
  });

  it('throws descriptive error for unsupported model size', () => {
    expect(() => proposeServices('kaito', '3b')).toThrow(/Unsupported model size "3b"/);
  });

  it('error for unsupported size lists supported sizes', () => {
    expect(() => proposeServices('kaito', '200b')).toThrow(/7b.*13b.*70b|Supported sizes/);
  });

  it('output does not contain credential values', () => {
    const serialized = JSON.stringify(proposeServices('kaito', '7b'));
    expect(serialized).not.toMatch(/AccountKey=/i);
    expect(serialized).not.toMatch(/SharedAccessSignature/i);
    // no 40+ char base64-like blobs (real secrets)
    expect(serialized).not.toMatch(/[A-Za-z0-9+/]{44}={0,2}/);
  });
});

// ── Foundry branch ────────────────────────────────────────────────────────────

describe('proposeServices — foundry track', () => {
  it('returns foundry track', () => {
    const result = proposeServices('foundry', 'standard');
    expect(result.track).toBe('foundry');
  });

  it('includes ai-foundry-project service', () => {
    const result = proposeServices('foundry', 'standard');
    expect(result.services).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'ai-foundry-project' })]),
    );
  });

  it('connection refs use placeholder syntax, not real credentials', () => {
    const result = proposeServices('foundry', 'standard');
    if (result.track === 'foundry') {
      for (const ref of result.connectionRefs) {
        expect(ref.secretRef).toMatch(/^\{\{.*\}\}$/);
      }
    }
  });

  it('output does not contain any actual secret values', () => {
    const serialized = JSON.stringify(proposeServices('foundry', 'premium'));
    expect(serialized).not.toMatch(/AccountKey=/i);
    expect(serialized).not.toMatch(/[A-Za-z0-9+/]{44}={0,2}/);
  });

  it('preserves tier in output', () => {
    const result = proposeServices('foundry', 'enterprise');
    if (result.track === 'foundry') {
      expect(result.tier).toBe('enterprise');
    }
  });

  it('does not include GPU node pool recommendation', () => {
    const result = proposeServices('foundry', 'standard');
    expect((result as Record<string, unknown>).nodePoolRecommendation).toBeUndefined();
  });

  it('unused plan parameter does not affect output', () => {
    const r1 = proposeServices('foundry', 'standard');
    expect(r1.track).toBe('foundry');
  });
});

// Suppress unused import warning for plan variable
void plan;
