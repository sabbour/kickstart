import { describe, it, expect } from 'vitest';
import { estimateCostTool } from './estimate-cost.js';
import { pricingLookupTool } from './pricing-lookup.js';
import { validateBicepTool } from './validate-bicep.js';
import { whatIfTool } from './what-if.js';

describe('Azure tool schema compatibility', () => {
  it('imports tools that use nullable optional input fields', () => {
    expect(estimateCostTool.tool).toBeDefined();
    expect(pricingLookupTool.tool).toBeDefined();
    expect(validateBicepTool.tool).toBeDefined();
    expect(whatIfTool.tool).toBeDefined();
  });
});