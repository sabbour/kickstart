/**
 * Unit test for `src/lib/configure-zod.ts` — verifies that importing the
 * module sets Zod v4's `globalConfig.jitless` to `true` BEFORE any v4
 * schema constructor runs. This is how the web bundle avoids the
 * `allowsEval` probe (`new Function('')`) that would otherwise violate
 * `script-src 'self'`. See issue #1042.
 */

import { describe, it, expect } from 'vitest';

describe('configure-zod — disables Zod v4 JIT (#1042)', () => {
  it('sets jitless=true on zod/v4 globalConfig', async () => {
    // Importing the module triggers `config({ jitless: true })` at module
    // top. Must resolve the SAME `zod/v4` instance the module mutates.
    await import('../lib/configure-zod');
    const { globalConfig } = await import('zod/v4/core');
    expect(globalConfig.jitless).toBe(true);
  });
});
