import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, unlinkSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathsMatch, COOLDOWN_MS, parseArgs } from '../scribe-escalation-guard.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'scribe-escalation-guard.mjs');
const STATE = join(__dirname, '..', '..', 'runtime', 'scrub-escalations.jsonl');

function run(args) {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout: out, stderr: '' };
  } catch (err) {
    return {
      code: err.status ?? 1,
      stdout: (err.stdout ?? Buffer.from('')).toString(),
      stderr: (err.stderr ?? Buffer.from('')).toString(),
    };
  }
}

function resetState() {
  if (existsSync(STATE)) unlinkSync(STATE);
}

describe('scribe-escalation-guard (Nibbler gap 9 mechanical guard)', () => {
  beforeEach(resetState);
  afterEach(resetState);

  it('check passes when there is no prior escalation', () => {
    const r = run(['check', '--role', 'scribe', '--paths', 'a.md', 'b.md']);
    expect(r.code).toBe(0);
  });

  it('check blocks immediately after a record within the 24h window', () => {
    const rec = run(['record', '--role', 'scribe', '--paths', 'x.md']);
    expect(rec.code).toBe(0);
    const chk = run(['check', '--role', 'scribe', '--paths', 'x.md']);
    expect(chk.code).toBe(1);
    expect(chk.stderr).toMatch(/BLOCKED/);
  });

  it('check passes after resolve is called', () => {
    run(['record', '--role', 'scribe', '--paths', 'y.md']);
    expect(run(['check', '--role', 'scribe', '--paths', 'y.md']).code).toBe(1);
    const res = run(['resolve', '--role', 'scribe', '--paths', 'y.md']);
    expect(res.code).toBe(0);
    const chk = run(['check', '--role', 'scribe', '--paths', 'y.md']);
    expect(chk.code).toBe(0);
  });

  it('check ignores escalations older than the 24h cooldown', () => {
    mkdirSync(dirname(STATE), { recursive: true });
    const old = new Date(Date.now() - COOLDOWN_MS - 60_000).toISOString();
    writeFileSync(
      STATE,
      JSON.stringify({ ts: old, role: 'scribe', paths: ['old.md'], reason: 't', resolved_at: null }) + '\n',
      'utf-8',
    );
    const chk = run(['check', '--role', 'scribe', '--paths', 'old.md']);
    expect(chk.code).toBe(0);
  });

  it('pathsMatch is order-independent', () => {
    expect(pathsMatch(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(pathsMatch(['a'], ['a', 'b'])).toBe(false);
  });

  // Nibbler PR #1091 round-2 empirical-probe regression:
  // The original parseArgs slurped everything after `--paths` to end-of-args
  // without respecting subsequent flags, so `--reason "<short>"` got absorbed
  // into the paths list and the whole JSONL state became length-mismatched.
  describe('parseArgs — --paths must terminate at next flag', () => {
    it('unit: --reason after --paths is NOT absorbed into paths', () => {
      const args = parseArgs([
        'node', 'scribe-escalation-guard.mjs', 'record',
        '--role', 'scribe',
        '--paths', 'a.md', 'b.md',
        '--reason', 'scrub-secrets --staged blocked',
      ]);
      expect(args.cmd).toBe('record');
      expect(args.role).toBe('scribe');
      expect(args.paths).toEqual(['a.md', 'b.md']);
      expect(args.reason).toBe('scrub-secrets --staged blocked');
    });

    it('unit: handles --paths with any flag ordering', () => {
      const args = parseArgs([
        'node', 'x.mjs', 'record',
        '--paths', 'a.md', '--reason', 'x', '--role', 'scribe',
      ]);
      expect(args.paths).toEqual(['a.md']);
      expect(args.reason).toBe('x');
      expect(args.role).toBe('scribe');
    });

    it('unit: --role before --paths still works (regression of existing case)', () => {
      const args = parseArgs([
        'node', 'x.mjs', 'check',
        '--role', 'scribe', '--paths', 'a.md', 'b.md',
      ]);
      expect(args.paths).toEqual(['a.md', 'b.md']);
      expect(args.role).toBe('scribe');
    });

    // Integration: full record -> check cycle via CLI using the exact
    // invocation pattern in squad.agent.md:1023 (record … --reason "<text>").
    // Before the fix, the second `check` would (wrongly) exit 0 because the
    // stored paths had `--reason` and the reason string appended.
    it('integration: record --paths … --reason … then check blocks within 24h', () => {
      const rec = run([
        'record',
        '--role', 'scribe',
        '--paths', 'charter.md', 'history.md',
        '--reason', 'scrub-secrets --staged blocked: ghs match',
      ]);
      expect(rec.code).toBe(0);

      // The recorded JSONL entry must have exactly the two paths, not four.
      const raw = readFileSync(STATE, 'utf-8').trim().split('\n');
      expect(raw.length).toBe(1);
      const entry = JSON.parse(raw[0]);
      expect(entry.paths).toEqual(['charter.md', 'history.md']);
      expect(entry.reason).toBe('scrub-secrets --staged blocked: ghs match');

      // Check against the exact same paths — MUST block.
      const chk = run([
        'check',
        '--role', 'scribe',
        '--paths', 'charter.md', 'history.md',
      ]);
      expect(chk.code).toBe(1);
      expect(chk.stderr).toMatch(/BLOCKED/);
    });
  });
});
