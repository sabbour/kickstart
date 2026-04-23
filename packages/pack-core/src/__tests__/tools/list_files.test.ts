import { describe, it, expect } from 'vitest';
import { listFilesTool } from '../../tools/list_files.js';

describe('core.list_files schema compatibility', () => {
  it('imports the SDK tool without schema conversion errors', () => {
    expect(listFilesTool.name).toBe('core.list_files');
    expect(listFilesTool.tool).toBeDefined();
  });
});