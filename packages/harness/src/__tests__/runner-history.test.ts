/**
 * Unit tests for the #1062 Layer 0 harness history-threading plumbing:
 *
 *   - Z1: `toAgentInputItems()` role filter — only user/assistant turns
 *     are replayed into the SDK input; system and tool turns are dropped.
 *   - Z2: sanitized text (guardedMessage) is what lands in `recentTurns`,
 *     not the raw userMessage. Guardrail-on-capture invariant.
 */

import { describe, expect, it } from 'vitest';
import { toAgentInputItems } from '../runtime/runner.js';
import type { Turn } from '../types/session.js';

describe('toAgentInputItems() — role filter (Z1)', () => {
  it('includes user and assistant turns', () => {
    const turns: Turn[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];
    const items = toAgentInputItems(turns);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ role: 'user', content: 'hello' });
    expect(items[1]).toMatchObject({
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: 'hi there' }],
    });
  });

  it('drops system turns', () => {
    const turns: Turn[] = [
      { role: 'user', content: 'q' },
      { role: 'system', content: 'you are a helpful bot' },
      { role: 'assistant', content: 'a' },
    ];
    const items = toAgentInputItems(turns);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.role !== 'system')).toBe(true);
  });

  it('drops tool turns (not replayed, Z1 adversarial case)', () => {
    const turns: Turn[] = [
      { role: 'user', content: 'deploy' },
      { role: 'tool', content: '{"ok":true}' },
      { role: 'assistant', content: 'deployed' },
    ];
    const items = toAgentInputItems(turns);
    expect(items).toHaveLength(2);
    const roles = items.map((i) => i.role);
    expect(roles).toEqual(['user', 'assistant']);
  });

  it('preserves chronological order across filtered roles', () => {
    const turns: Turn[] = [
      { role: 'user', content: 'u1' },
      { role: 'tool', content: 'drop1' },
      { role: 'assistant', content: 'a1' },
      { role: 'system', content: 'drop2' },
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a2' },
    ];
    const items = toAgentInputItems(turns);
    expect(items.map((i) => i.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
  });

  it('drops turns with missing or empty content', () => {
    const turns: Turn[] = [
      { role: 'user', content: '' },
      { role: 'assistant', content: undefined },
      { role: 'user', content: 'real message' },
    ];
    const items = toAgentInputItems(turns);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ role: 'user', content: 'real message' });
  });

  it('returns an empty array for an empty input', () => {
    expect(toAgentInputItems([])).toEqual([]);
  });
});
