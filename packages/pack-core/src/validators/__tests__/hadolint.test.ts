/**
 * @file hadolint.test.ts
 * @suite hadolint validator JSON parsing + severity mapping (#1136)
 *
 * Tests the parseHadolintOutput function directly (no binary needed).
 */

import { describe, it, expect } from 'vitest';
import { parseHadolintOutput } from '../../validators/hadolint.js';

describe('parseHadolintOutput', () => {
  it('parses valid hadolint JSON into violations', () => {
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
    });
    expect(violations[1]).toEqual({
      rule: 'DL3009',
      severity: 'info',
      line: 3,
      message: 'Delete the apt-get lists',
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
  });
});
