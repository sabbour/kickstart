/**
 * Unit tests for cold-session hydration helper (#1074 D3).
 *
 * Covers Leela's DP + Nibbler's additive conditions + Zapp's M3 trust marker:
 *  - brand-new session + valid messages → hydrated
 *  - warm session + messages → ignored
 *  - flag off → ignored (default + explicit)
 *  - empty `messages: []` distinct from `undefined` (Nibbler #2)
 *  - 21st message capped / dropped via the `cap` option (Nibbler #5 peer case)
 *  - tool/system roles never make it past the helper (defense in depth)
 *  - hydrated turns stamped `trust: 'client-hydrated'` (Zapp M3)
 *  - race: two concurrent cold hydrations on same session — first-writer-wins
 *    (Nibbler #9)
 *  - runner replay renders hydrated turns inside untrusted-context delimiters
 *    (Zapp M3 integration)
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  Session,
  hydrateColdSession,
  isHistoryHydrationEnabled,
  isAnonHydrationAllowed,
  HYDRATION_DEFAULT_CAP,
} from '../runtime/session.js';
import type { ClientHydrationMessage } from '../runtime/session.js';
import { toAgentInputItems } from '../runtime/runner.js';

function makeSession(oid = 'user-1'): Session {
  return new Session({ sessionId: 'sess-1', user: { oid } });
}

describe('isHistoryHydrationEnabled / isAnonHydrationAllowed — env flag helpers', () => {
  const originalHistory = process.env.HARNESS_SESSION_HISTORY_ENABLED;
  const originalAnon = process.env.HARNESS_ALLOW_ANON_HYDRATION;

  afterEach(() => {
    if (originalHistory === undefined) delete process.env.HARNESS_SESSION_HISTORY_ENABLED;
    else process.env.HARNESS_SESSION_HISTORY_ENABLED = originalHistory;
    if (originalAnon === undefined) delete process.env.HARNESS_ALLOW_ANON_HYDRATION;
    else process.env.HARNESS_ALLOW_ANON_HYDRATION = originalAnon;
  });

  it('defaults OFF when flag unset', () => {
    delete process.env.HARNESS_SESSION_HISTORY_ENABLED;
    delete process.env.HARNESS_ALLOW_ANON_HYDRATION;
    expect(isHistoryHydrationEnabled()).toBe(false);
    expect(isAnonHydrationAllowed()).toBe(false);
  });

  it('accepts "1" and "true" (case-insensitive) as ON', () => {
    for (const v of ['1', 'true', 'TRUE', 'True']) {
      process.env.HARNESS_SESSION_HISTORY_ENABLED = v;
      expect(isHistoryHydrationEnabled()).toBe(true);
      process.env.HARNESS_ALLOW_ANON_HYDRATION = v;
      expect(isAnonHydrationAllowed()).toBe(true);
    }
  });

  it('rejects other truthy strings', () => {
    process.env.HARNESS_SESSION_HISTORY_ENABLED = 'yes';
    expect(isHistoryHydrationEnabled()).toBe(false);
    process.env.HARNESS_ALLOW_ANON_HYDRATION = 'on';
    expect(isAnonHydrationAllowed()).toBe(false);
  });
});

describe('hydrateColdSession — happy path', () => {
  it('writes N turns when recentTurns is empty and flag is on', () => {
    const s = makeSession();
    const msgs: ClientHydrationMessage[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'how are you' },
    ];
    const result = hydrateColdSession(s, msgs, { enabled: true });
    expect(result).toEqual({ hydrated: 3, ignored: null });
    expect(s.recentTurns).toHaveLength(3);
    expect(s.recentTurns.map((t) => t.role)).toEqual(['user', 'assistant', 'user']);
    expect(s.recentTurns.map((t) => t.content)).toEqual(['hi', 'hello', 'how are you']);
  });

  it('stamps every hydrated turn with trust: "client-hydrated" (Zapp M3)', () => {
    const s = makeSession();
    hydrateColdSession(
      s,
      [{ role: 'user', content: 'u' }, { role: 'assistant', content: 'a' }],
      { enabled: true },
    );
    expect(s.recentTurns.every((t) => t.trust === 'client-hydrated')).toBe(true);
  });

  it('stamps a timestamp on each hydrated turn', () => {
    const s = makeSession();
    hydrateColdSession(s, [{ role: 'user', content: 'x' }], { enabled: true });
    expect(typeof s.recentTurns[0].timestamp).toBe('string');
    expect(() => new Date(s.recentTurns[0].timestamp!).toISOString()).not.toThrow();
  });
});

describe('hydrateColdSession — no-op branches', () => {
  it('no-ops when flag is off (explicit enabled=false)', () => {
    const s = makeSession();
    const result = hydrateColdSession(
      s,
      [{ role: 'user', content: 'x' }],
      { enabled: false },
    );
    expect(result).toEqual({ hydrated: 0, ignored: 'disabled' });
    expect(s.recentTurns).toHaveLength(0);
  });

  it('no-ops when session is warm (recentTurns.length > 0)', () => {
    const s = makeSession();
    s.recordTurn({ role: 'user', content: 'server-authored' });
    const result = hydrateColdSession(
      s,
      [{ role: 'user', content: 'client-attempt' }],
      { enabled: true },
    );
    expect(result).toEqual({ hydrated: 0, ignored: 'warm' });
    expect(s.recentTurns).toHaveLength(1);
    expect(s.recentTurns[0].content).toBe('server-authored');
    expect(s.recentTurns[0].trust).toBeUndefined();
  });

  // Nibbler #2: empty array is distinct from undefined.
  it('empty messages array on cold session returns hydrated=0, ignored=null', () => {
    const s = makeSession();
    const result = hydrateColdSession(s, [], { enabled: true });
    expect(result).toEqual({ hydrated: 0, ignored: null });
    expect(s.recentTurns).toHaveLength(0);
  });

  it('undefined messages on cold session returns hydrated=0, ignored=null', () => {
    const s = makeSession();
    const result = hydrateColdSession(s, undefined, { enabled: true });
    expect(result).toEqual({ hydrated: 0, ignored: null });
    expect(s.recentTurns).toHaveLength(0);
  });
});

describe('hydrateColdSession — filters', () => {
  it('drops tool and system roles (defense-in-depth over the schema)', () => {
    const s = makeSession();
    // Cast because the schema already rejects these at the boundary; test the
    // helper's own belt-and-braces filter.
    const msgs = [
      { role: 'user', content: 'u' },
      { role: 'tool', content: 'tool-out' },
      { role: 'system', content: 'sys' },
      { role: 'assistant', content: 'a' },
    ] as unknown as ClientHydrationMessage[];
    const result = hydrateColdSession(s, msgs, { enabled: true });
    expect(result.hydrated).toBe(2);
    expect(s.recentTurns.map((t) => t.role)).toEqual(['user', 'assistant']);
  });

  it('applies cap (cap+1 entries are truncated at the tail)', () => {
    const s = makeSession();
    const msgs: ClientHydrationMessage[] = Array.from(
      { length: HYDRATION_DEFAULT_CAP + 5 },
      (_, i) => ({ role: 'user', content: `m${i}` }),
    );
    const result = hydrateColdSession(s, msgs, { enabled: true, cap: HYDRATION_DEFAULT_CAP });
    expect(result.hydrated).toBe(HYDRATION_DEFAULT_CAP);
    expect(s.recentTurns).toHaveLength(HYDRATION_DEFAULT_CAP);
    expect(s.recentTurns[0].content).toBe('m0');
    expect(s.recentTurns[HYDRATION_DEFAULT_CAP - 1].content).toBe(`m${HYDRATION_DEFAULT_CAP - 1}`);
  });

  it('drops empty-content entries', () => {
    const s = makeSession();
    const msgs: ClientHydrationMessage[] = [
      { role: 'user', content: 'keep' },
      { role: 'assistant', content: '' },
    ];
    const result = hydrateColdSession(s, msgs, { enabled: true });
    expect(result.hydrated).toBe(1);
    expect(s.recentTurns).toHaveLength(1);
  });
});

describe('hydrateColdSession — race / first-writer-wins (Nibbler #9)', () => {
  it('two concurrent cold hydrations on the same session: first wins, second no-ops', () => {
    const s = makeSession();
    // In-process, hydrateColdSession is synchronous — the JS event-loop makes
    // the existence check + push race-free for a given sessionId. This test
    // locks that contract in so a future async-refactor cannot regress it.
    const a = hydrateColdSession(s, [{ role: 'user', content: 'first' }], { enabled: true });
    const b = hydrateColdSession(s, [{ role: 'user', content: 'second' }], { enabled: true });
    expect(a).toEqual({ hydrated: 1, ignored: null });
    expect(b).toEqual({ hydrated: 0, ignored: 'warm' });
    expect(s.recentTurns).toHaveLength(1);
    expect(s.recentTurns[0].content).toBe('first');
  });
});

describe('toAgentInputItems — untrusted-context delimiters (Zapp M3)', () => {
  it('wraps client-hydrated user content in untrusted-context delimiters', () => {
    const s = makeSession();
    hydrateColdSession(s, [{ role: 'user', content: 'hello' }], { enabled: true });
    const items = toAgentInputItems(s.recentTurns);
    expect(items).toHaveLength(1);
    const text = (items[0] as { content: string }).content;
    expect(text).toContain('[BEGIN UNTRUSTED CONTEXT');
    expect(text).toContain('hello');
    expect(text).toContain('[END UNTRUSTED CONTEXT]');
  });

  it('wraps client-hydrated assistant content as well', () => {
    const s = makeSession();
    hydrateColdSession(s, [{ role: 'assistant', content: 'prior reply' }], { enabled: true });
    const items = toAgentInputItems(s.recentTurns);
    const content = (items[0] as { role: 'assistant'; content: Array<{ text: string }> }).content;
    expect(content[0].text).toContain('[BEGIN UNTRUSTED CONTEXT');
    expect(content[0].text).toContain('prior reply');
    expect(content[0].text).toContain('[END UNTRUSTED CONTEXT]');
  });

  it('does NOT wrap server-authored turns', () => {
    const s = makeSession();
    s.recordTurn({ role: 'user', content: 'server input' });
    const items = toAgentInputItems(s.recentTurns);
    const text = (items[0] as { content: string }).content;
    expect(text).toBe('server input');
    expect(text).not.toContain('UNTRUSTED');
  });
});
