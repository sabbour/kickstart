import { describe, it, expect } from 'vitest';
import { parseArgs, validateArgs } from '../post-flight-check.mjs';

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

describe('post-flight-check / validateArgs', () => {
  it('validates review kind requires --pr and --id', () => {
    let error = validateArgs('review', { kind: 'review' });
    expect(error).toContain('requires --pr and --id');

    error = validateArgs('review', { kind: 'review', pr: '123' });
    expect(error).toContain('requires --pr and --id');

    error = validateArgs('review', { kind: 'review', pr: '123', id: '456' });
    expect(error).toBeNull();
  });

  it('validates comment kind requires --id', () => {
    let error = validateArgs('comment', { kind: 'comment', issue: '123' });
    expect(error).toContain('requires --id');

    error = validateArgs('comment', { kind: 'comment', pr: '123' });
    expect(error).toContain('requires --id');

    error = validateArgs('comment', { kind: 'comment', issue: '123', id: '456' });
    expect(error).toBeNull();

    error = validateArgs('comment', { kind: 'comment', pr: '123', id: '456' });
    expect(error).toBeNull();
  });

  it('validates label kind requires --issue and --label', () => {
    let error = validateArgs('label', { kind: 'label' });
    expect(error).toContain('requires --issue');

    error = validateArgs('label', { kind: 'label', issue: '123' });
    expect(error).toContain('requires --label');

    error = validateArgs('label', { kind: 'label', issue: '123', label: 'approved' });
    expect(error).toBeNull();
  });

  it('validates pr-create kind requires --pr', () => {
    let error = validateArgs('pr-create', { kind: 'pr-create' });
    expect(error).toContain('requires --pr');

    error = validateArgs('pr-create', { kind: 'pr-create', pr: '123' });
    expect(error).toBeNull();
  });

  it('validates issue-edit kind requires --issue', () => {
    let error = validateArgs('issue-edit', { kind: 'issue-edit' });
    expect(error).toContain('requires --issue');

    error = validateArgs('issue-edit', { kind: 'issue-edit', issue: '123' });
    expect(error).toBeNull();
  });

  it('validates commit kind requires --sha', () => {
    let error = validateArgs('commit', { kind: 'commit' });
    expect(error).toContain('requires --sha');

    error = validateArgs('commit', { kind: 'commit', sha: 'abc123' });
    expect(error).toBeNull();
  });

  it('rejects unknown kind', () => {
    const error = validateArgs('unknown-kind', {});
    expect(error).toContain('unknown kind');
  });
});
