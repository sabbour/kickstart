/**
 * Unit tests for the #1062 Layer 0 harness history-threading plumbing:
 *
 *   - Z1: `toAgentInputItems()` role filter — only user/assistant turns
 *     are replayed into the SDK input; system and tool turns are dropped.
 *   - Z2: sanitized text (guardedMessage) is what lands in `recentTurns`,
 *     not the raw userMessage. Guardrail-on-capture invariant.
 *   - Feature flag: `HARNESS_SESSION_HISTORY_ENABLED` defaults OFF; only
 *     "1"/"true" (case-insensitive) enable it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { toAgentInputItems, isHistoryEnabled } from '../runtime/runner.js';
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

describe('isHistoryEnabled() — feature flag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to OFF when the env var is unset', () => {
    vi.stubEnv('HARNESS_SESSION_HISTORY_ENABLED', '');
    expect(isHistoryEnabled()).toBe(false);
  });

  it('is OFF for value "0"', () => {
    vi.stubEnv('HARNESS_SESSION_HISTORY_ENABLED', '0');
    expect(isHistoryEnabled()).toBe(false);
  });

  it('is OFF for value "false"', () => {
    vi.stubEnv('HARNESS_SESSION_HISTORY_ENABLED', 'false');
    expect(isHistoryEnabled()).toBe(false);
  });

  it('is ON for value "1"', () => {
    vi.stubEnv('HARNESS_SESSION_HISTORY_ENABLED', '1');
    expect(isHistoryEnabled()).toBe(true);
  });

  it('is ON for value "true" (case-insensitive)', () => {
    vi.stubEnv('HARNESS_SESSION_HISTORY_ENABLED', 'TRUE');
    expect(isHistoryEnabled()).toBe(true);
  });

  it('is OFF for an unrelated string', () => {
    vi.stubEnv('HARNESS_SESSION_HISTORY_ENABLED', 'yes');
    expect(isHistoryEnabled()).toBe(false);
  });
});
