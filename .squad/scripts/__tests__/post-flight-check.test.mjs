import { describe, it, expect } from 'vitest';
import { parseArgs } from '../post-flight-check.mjs';

describe('post-flight-check / parseArgs', () => {
  it('parses review kind with id + expected login', () => {
    const args = parseArgs([
      'node', 'post-flight-check.mjs',
      '--kind', 'review',
      '--owner', 'sabbour',
      '--repo', 'kickstart',
      '--pr', '1086',
      '--id', '4157399527',
      '--expected-login', 'sabbour-squad-lead[bot]',
    ]);
    expect(args.kind).toBe('review');
    expect(args.owner).toBe('sabbour');
    expect(args.repo).toBe('kickstart');
    expect(args.pr).toBe('1086');
    expect(args.id).toBe('4157399527');
    expect(args.expectedLogin).toBe('sabbour-squad-lead[bot]');
  });

  it('parses label kind with label name', () => {
    const args = parseArgs([
      'node', 'x.mjs',
      '--kind', 'label',
      '--issue', '1087',
      '--label', 'leela:approved-dp',
      '--owner', 'a',
      '--repo', 'b',
      '--expected-login', 'sabbour-squad-lead[bot]',
    ]);
    expect(args.kind).toBe('label');
    expect(args.label).toBe('leela:approved-dp');
    expect(args.issue).toBe('1087');
  });

  it('accepts --json flag', () => {
    const args = parseArgs(['node', 'x.mjs', '--json', '--kind', 'commit', '--sha', 'abc']);
    expect(args.json).toBe(true);
    expect(args.kind).toBe('commit');
    expect(args.sha).toBe('abc');
  });
});
