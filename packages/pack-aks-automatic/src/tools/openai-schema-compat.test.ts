import { describe, it, expect } from 'vitest';
import { validateManifestsTool } from './validate-manifests.js';
import { validateSafeguardsTool } from './validate-safeguards.js';

describe('AKS tool schema compatibility', () => {
  it('imports tools that use nullable optional input fields', () => {
    expect(validateManifestsTool.tool).toBeDefined();
    expect(validateSafeguardsTool.tool).toBeDefined();
  });
});