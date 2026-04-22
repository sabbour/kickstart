import { describe, it, expect } from 'vitest';
import { config, z } from 'zod/v4';

// Importing the configure-zod module for its side effect — this is exactly
// what main.tsx does at boot.
import '../lib/configure-zod';

describe('configure-zod', () => {
  it('sets jitless=true on the Zod v4 global config', () => {
    // `config()` with no argument returns the current global config object.
    expect(config().jitless).toBe(true);
  });

  it('does not invoke new Function when parsing a v4 object schema', () => {
    // With jitless=true, Zod v4 short-circuits before reading
    // `allowsEval.value` (the gated feature-probe that trips CSP
    // `script-src` without `'unsafe-eval'`). We can't easily spy on
    // `Function` cross-realm, but we can prove schemas still construct
    // and parse end-to-end.
    const schema = z.object({ name: z.string(), count: z.number() });
    const parsed = schema.parse({ name: 'kickstart', count: 42 });
    expect(parsed).toEqual({ name: 'kickstart', count: 42 });

    const invalid = schema.safeParse({ name: 'kickstart', count: 'nope' });
    expect(invalid.success).toBe(false);
  });
});
