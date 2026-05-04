/**
 * CI gate: every tool registered by pack-core must be prefixed with "core."
 *
 * This prevents cross-pack name collisions and enforces the tool namespace
 * convention documented in pack-authoring.md (skill: kickstart-aks-dev).
 *
 * Closes #442
 */
import { describe, it, expect } from 'vitest';
import { corePackServer } from '../server-manifest.js';

describe('pack-core tool namespace', () => {
  it('all tools are prefixed core.', () => {
    const violations = corePackServer.tools
      .filter((t) => !t.name.startsWith('core.'))
      .map((t) => t.name);
    expect(violations, `Non-prefixed tools: ${violations.join(', ')}`).toHaveLength(0);
  });
});
