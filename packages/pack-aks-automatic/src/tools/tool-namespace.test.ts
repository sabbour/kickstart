/**
 * CI gate: every tool registered by pack-aks-automatic must be prefixed with "aks."
 *
 * This prevents cross-pack name collisions and enforces the tool namespace
 * convention documented in pack-authoring.md (skill: kickstart-aks-dev).
 *
 * Closes #442
 */
import { describe, it, expect } from 'vitest';
import { aksAutomaticPackServer } from '../server-manifest.js';

describe('pack-aks-automatic tool namespace', () => {
  it('all tools are prefixed aks.', () => {
    const violations = aksAutomaticPackServer.tools
      .filter((t) => !t.name.startsWith('aks.'))
      .map((t) => t.name);
    expect(violations, `Non-prefixed tools: ${violations.join(', ')}`).toHaveLength(0);
  });
});
