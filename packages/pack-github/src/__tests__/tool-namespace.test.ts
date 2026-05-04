/**
 * CI gate: every tool registered by pack-github must be prefixed with "github."
 *
 * This prevents cross-pack name collisions and enforces the tool namespace
 * convention documented in pack-authoring.md (skill: kickstart-aks-dev).
 *
 * Closes #442
 */
import { describe, it, expect } from 'vitest';
import { githubPackServer } from '../server-manifest.js';

describe('pack-github tool namespace', () => {
  it('all tools are prefixed github.', () => {
    const violations = githubPackServer.tools
      .filter((t) => !t.name.startsWith('github.'))
      .map((t) => t.name);
    expect(violations, `Non-prefixed tools: ${violations.join(', ')}`).toHaveLength(0);
  });
});
