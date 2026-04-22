#!/usr/bin/env node
// .squad/scripts/scribe-escalation-guard.mjs
//
// Mechanical self-review loop guard for Scribe (Nibbler gap 9 → PR #1091 C7).
//
// When `scrub-secrets.mjs --staged` blocks a Scribe commit, Scribe MUST NOT
// auto-retry on the same files within 24 hours. Previously this rule was
// prose-only in the charter; that is the exact failure mode (prose ignored)
// that led to #1087. This script makes the guard mechanical.
//
// State file: .squad/runtime/scrub-escalations.jsonl (append-only, gitignored).
// Schema: one JSON object per line:
//   { "ts": <ISO8601 UTC>, "role": "<role>", "paths": ["<path>",...],
//     "reason": "<short>", "resolved_at": <ISO8601 UTC> | null }
//
// Usage:
//   # Scribe calls this BEFORE `git commit` when `--staged` exited non-zero:
//   node scribe-escalation-guard.mjs record --role scribe --paths FILE FILE
//
//   # Scribe calls this BEFORE any retry to check if the same paths were
//   # already escalated within the 24h cool-down:
//   node scribe-escalation-guard.mjs check --role scribe --paths FILE FILE
//   # exit 0 => ok to proceed; exit 1 => blocked (prior escalation within 24h)
//
//   # Leela (only) marks an escalation resolved after remediation:
//   node scribe-escalation-guard.mjs resolve --role scribe --paths FILE FILE

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function teamRoot() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return join(scriptDir, '..', '..');
}

function statePath() {
  return join(teamRoot(), '.squad', 'runtime', 'scrub-escalations.jsonl');
}

function loadEntries() {
  const p = statePath();
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, 'utf-8');
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function appendEntry(entry) {
  const p = statePath();
  mkdirSync(dirname(p), { recursive: true });
  appendFileSync(p, JSON.stringify(entry) + '\n', 'utf-8');
}

function parseArgs(argv) {
  const [, , cmd, ...rest] = argv;
  const out = { cmd, role: null, paths: [], reason: '' };
  const FLAGS = new Set(['--role', '--reason', '--paths']);

  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--role') {
      out.role = rest[++i];
    } else if (a === '--reason') {
      out.reason = rest[++i];
    } else if (a === '--paths') {
      // Nibbler PR #1091 round-2: `--paths` must terminate when it hits the
      // next flag, not slurp to end-of-args. The prior implementation
      // silently absorbed `--reason "<text>"` into the paths list, which
      // made the JSONL cooldown state length-mismatch with every subsequent
      // `check` invocation and effectively disabled the 24h guard.
      i++;
      while (i < rest.length && !FLAGS.has(rest[i])) {
        out.paths.push(rest[i]);
        i++;
      }
      // Step back one so the outer for-loop's i++ re-examines the flag.
      i--;
    }
  }
  return out;
}

function pathsMatch(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((p, i) => p === sb[i]);
}

function main() {
  const { cmd, role, paths, reason } = parseArgs(process.argv);
  if (!cmd || !['record', 'check', 'resolve', 'list'].includes(cmd)) {
    process.stderr.write(
      'Usage: scribe-escalation-guard.mjs <record|check|resolve|list> [--role X] [--paths ...]\n',
    );
    process.exit(2);
  }

  const now = Date.now();
  const entries = loadEntries();

  if (cmd === 'list') {
    for (const e of entries) process.stdout.write(JSON.stringify(e) + '\n');
    return;
  }

  if (!role || paths.length === 0) {
    process.stderr.write('scribe-escalation-guard: --role and --paths are required\n');
    process.exit(2);
  }

  if (cmd === 'record') {
    appendEntry({
      ts: new Date(now).toISOString(),
      role,
      paths,
      reason: reason || 'scrub-secrets --staged blocked',
      resolved_at: null,
    });
    process.stderr.write(
      `scribe-escalation-guard: recorded escalation for ${role} (${paths.length} path(s)). Auto-retry blocked for 24h.\n`,
    );
    return;
  }

  if (cmd === 'check') {
    const recent = entries.filter(
      (e) =>
        e.role === role &&
        !e.resolved_at &&
        pathsMatch(e.paths, paths) &&
        now - new Date(e.ts).getTime() < COOLDOWN_MS,
    );
    if (recent.length === 0) {
      process.stderr.write(`scribe-escalation-guard: no recent escalation — proceed.\n`);
      return; // exit 0
    }
    process.stderr.write(
      `scribe-escalation-guard: BLOCKED — ${recent.length} unresolved escalation(s) for these paths within 24h.\n` +
        `  Auto-retry is disabled per Nibbler gap 9 (self-review loop guard).\n` +
        `  Resolve via Leela remediation only, then run \`scribe-escalation-guard.mjs resolve …\`.\n`,
    );
    process.exit(1);
  }

  if (cmd === 'resolve') {
    // Rewrite the file with matching entries marked resolved.
    const nowIso = new Date(now).toISOString();
    const updated = entries.map((e) => {
      if (e.role === role && !e.resolved_at && pathsMatch(e.paths, paths)) {
        return { ...e, resolved_at: nowIso };
      }
      return e;
    });
    mkdirSync(dirname(statePath()), { recursive: true });
    writeFileSync(
      statePath(),
      updated.map((e) => JSON.stringify(e)).join('\n') + (updated.length ? '\n' : ''),
      'utf-8',
    );
    process.stderr.write(`scribe-escalation-guard: marked ${paths.length} path(s) resolved for ${role}.\n`);
    return;
  }
}

export { parseArgs, loadEntries, pathsMatch, COOLDOWN_MS };

const isCliInvocation =
  typeof process.argv[1] === 'string' &&
  resolvePath(process.argv[1]).endsWith('scribe-escalation-guard.mjs');

if (isCliInvocation) {
  main();
}
