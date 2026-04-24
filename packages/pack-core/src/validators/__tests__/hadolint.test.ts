/**
 * @file hadolint.test.ts
 * @suite hadolint validator JSON parsing, severity mapping, fix hints, and output sanitization (#10)
 *
 * Tests the parseHadolintOutput function directly (no binary needed).
 */

import { describe, it, expect, vi } from 'vitest';
import { parseHadolintOutput, HADOLINT_FIX_HINTS, sanitizeMessage } from '../../validators/hadolint.js';

describe('parseHadolintOutput', () => {
  it('parses valid hadolint JSON into violations with fix hints', () => {
    const json = JSON.stringify([
      { line: 1, code: 'DL3007', message: 'Using latest is prone to errors', level: 'warning' },
      { line: 3, code: 'DL3009', message: 'Delete the apt-get lists', level: 'info' },
    ]);

    const violations = parseHadolintOutput(json);

    expect(violations).toHaveLength(2);
    expect(violations[0]).toEqual({
      rule: 'DL3007',
      severity: 'warning',
      line: 1,
      message: 'Using latest is prone to errors',
      fix: 'Pin the base image to a specific version tag (avoid `:latest`).',
    });
    expect(violations[1]).toEqual({
      rule: 'DL3009',
      severity: 'info',
      line: 3,
      message: 'Delete the apt-get lists',
      fix: 'Delete apt-get lists after install: `rm -rf /var/lib/apt/lists/*`.',
    });
  });

  it('returns empty array for empty violations', () => {
    const violations = parseHadolintOutput('[]');
    expect(violations).toEqual([]);
  });

  it('maps error severity correctly', () => {
    const json = JSON.stringify([
      { line: 1, code: 'DL3000', message: 'Use absolute paths', level: 'error' },
    ]);

    const violations = parseHadolintOutput(json);
    expect(violations[0].severity).toBe('error');
  });

  it('maps style severity to info', () => {
    const json = JSON.stringify([
      { line: 5, code: 'DL3059', message: 'Multiple COPY instructions', level: 'style' },
    ]);

    const violations = parseHadolintOutput(json);
    expect(violations[0].severity).toBe('info');
  });

  it('maps warning severity correctly', () => {
    const json = JSON.stringify([
      { line: 2, code: 'DL3003', message: 'Use WORKDIR to switch directories', level: 'warning' },
    ]);

    const violations = parseHadolintOutput(json);
    expect(violations[0].severity).toBe('warning');
  });

  it('returns empty array for invalid JSON', () => {
    const violations = parseHadolintOutput('not json');
    expect(violations).toEqual([]);
  });

  it('returns empty array for non-array JSON', () => {
    const violations = parseHadolintOutput('{"error": "something"}');
    expect(violations).toEqual([]);
  });

  it('handles items with missing fields gracefully', () => {
    const json = JSON.stringify([
      { line: 1, code: 'DL3007' },
    ]);

    const violations = parseHadolintOutput(json);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('DL3007');
    expect(violations[0].message).toBe('');
    expect(violations[0].severity).toBe('info');
    expect(violations[0].fix).toBe(HADOLINT_FIX_HINTS['DL3007']);
  });
});

describe('fix hint mapping', () => {
  it('attaches fix hint for well-known rules', () => {
    const knownRules = ['DL3007', 'DL3008', 'DL3015', 'DL3020', 'DL4006'];
    for (const rule of knownRules) {
      const json = JSON.stringify([{ line: 1, code: rule, message: 'test', level: 'warning' }]);
      const violations = parseHadolintOutput(json);
      expect(violations[0].fix).toBe(HADOLINT_FIX_HINTS[rule]);
    }
  });

  it('omits fix for unknown rules', () => {
    const json = JSON.stringify([{ line: 1, code: 'DL9999', message: 'unknown rule', level: 'warning' }]);
    const violations = parseHadolintOutput(json);
    expect(violations[0].fix).toBeUndefined();
  });

  it('HADOLINT_FIX_HINTS covers critical Dockerfile rules', () => {
    const critical = ['DL3007', 'DL3008', 'DL3015', 'DL3006', 'DL3009'];
    for (const rule of critical) {
      expect(HADOLINT_FIX_HINTS[rule]).toBeDefined();
      expect(typeof HADOLINT_FIX_HINTS[rule]).toBe('string');
    }
  });
});

describe('output sanitization', () => {
  it('truncates overly long messages', () => {
    const longMessage = 'x'.repeat(500);
    const json = JSON.stringify([{ line: 1, code: 'DL9999', message: longMessage, level: 'warning' }]);
    const violations = parseHadolintOutput(json);
    expect(violations[0].message.length).toBeLessThanOrEqual(257); // 256 + ellipsis
  });

  it('strips ANSI escape codes from messages', () => {
    const ansiMessage = '\x1B[31mDanger\x1B[0m zone';
    const json = JSON.stringify([{ line: 1, code: 'DL9999', message: ansiMessage, level: 'warning' }]);
    const violations = parseHadolintOutput(json);
    expect(violations[0].message).toBe('Danger zone');
  });

  it('strips control characters from messages', () => {
    const controlMessage = 'bad\x00char\x07here';
    const json = JSON.stringify([{ line: 1, code: 'DL9999', message: controlMessage, level: 'warning' }]);
    const violations = parseHadolintOutput(json);
    expect(violations[0].message).not.toContain('\x00');
    expect(violations[0].message).not.toContain('\x07');
  });
});

describe('sanitizeMessage (stderr sanitization — Zapp Fix 3)', () => {
  it('strips ANSI escape codes', () => {
    expect(sanitizeMessage('\x1B[31mError\x1B[0m text')).toBe('Error text');
  });

  it('strips control characters', () => {
    expect(sanitizeMessage('bad\x00char\x07here')).toBe('badcharhere');
  });

  it('truncates to 256 chars + ellipsis', () => {
    const long = 'A'.repeat(500);
    const result = sanitizeMessage(long);
    expect(result.length).toBeLessThanOrEqual(257);
    expect(result.endsWith('…')).toBe(true);
  });

  it('returns short strings unchanged', () => {
    expect(sanitizeMessage('all good')).toBe('all good');
  });
});

describe('resolveHadolint provenance (Zapp Fix 1)', () => {
  it('rejects PATH binary with wrong SHA256', async () => {
    // Dynamic import to allow mocking fs/child_process per test
    vi.doMock('node:child_process', () => ({
      execFileSync: () => '/usr/local/bin/hadolint',
      spawn: vi.fn(),
    }));
    vi.doMock('node:fs', () => ({
      existsSync: () => false,
      readFileSync: () => Buffer.from('fake-binary-content'),
      mkdirSync: vi.fn(),
      chmodSync: vi.fn(),
      createWriteStream: vi.fn(),
      unlinkSync: vi.fn(),
    }));
    vi.doMock('node:crypto', () => ({
      createHash: () => ({
        update: () => ({
          digest: () => 'aaaa_wrong_hash_aaaa',
        }),
      }),
    }));

    const { resolveHadolint } = await import('../../validators/hadolint.js');
    const result = await resolveHadolint();
    // PATH binary hash doesn't match → should NOT return /usr/local/bin/hadolint
    expect(result).not.toBe('/usr/local/bin/hadolint');
    vi.restoreAllMocks();
  });
});
