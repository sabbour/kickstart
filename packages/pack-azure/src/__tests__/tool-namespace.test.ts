/**
 * CI gate: every tool registered by pack-azure must be prefixed with "azure."
 *
 * This prevents cross-pack name collisions and enforces the tool namespace
 * convention documented in pack-authoring.md (skill: kickstart-aks-dev).
 *
 * Closes #442
 */
import { describe, it, expect } from 'vitest';
import { azurePackServer } from '../server-manifest.js';
import { azurePack } from '../index.js';

describe('pack-azure tool namespace', () => {
  it('all server-manifest tools are prefixed azure.', () => {
    const violations = azurePackServer.tools
      .filter((t) => !t.name.startsWith('azure.'))
      .map((t) => t.name);
    expect(violations, `Non-prefixed tools: ${violations.join(', ')}`).toHaveLength(0);
  });

  it('all pack tools (including client-only) are prefixed azure.', () => {
    const violations = azurePack.tools
      .filter((t) => !t.name.startsWith('azure.'))
      .map((t) => t.name);
    expect(violations, `Non-prefixed tools: ${violations.join(', ')}`).toHaveLength(0);
  });
});
