import { describe, it, expect } from 'vitest';
import { apiGetTool } from './api-get.js';

describe('GitHub tool schema compatibility', () => {
  it('imports tools that use nullable optional input fields', () => {
    expect(apiGetTool.name).toBe('github.api_get');
    expect(apiGetTool.tool).toBeDefined();
  });
});