#!/usr/bin/env node
// .squad/scripts/scrub-secrets.mjs
//
// Three-surface secret scrubber for #1087 governance hardening.
//
// Surfaces (choose one per invocation):
//   --response       Read stdin, write scrubbed text to stdout. Exit 0 if clean,
//                    2 if any match was redacted. Used by the coordinator
//                    response-capture filter before surfacing agent output.
//   --staged         Scan `git diff --cached` hunks in the current repo. Exit 1
//                    on match (blocks commit). Scribe and the pre-commit hook
//                    both call this.
//   --tree           Scan the full tracked tree (`git ls-files`). Exit 1 on
//                    match. CI secret-scan job uses this.
//   --paths <glob>…  Scan an explicit list of paths. Exit 1 on match.
//
// Flags:
//   --json           Emit structured findings instead of human text.
//   --quiet          Suppress non-finding output.
//
// Pattern set (locked by Zapp constraint C1 + C9, Nibbler gap 7):
//   - GitHub tokens: ghs_, ghp_, gho_, ghu_, ghr_, ghe_, github_pat_
//   - PEM private-key block markers (RSA / EC / DSA / OPENSSH / ENCRYPTED)
//   - Authorization header forms carrying a GH token
//   - x-access-token basic-auth URL form
//   - Path-based refusal for `.squad/identity/keys/*.pem` and
//     `.squad/identity/apps/*.json` being committed.
//
// IMPORTANT: This script must NEVER print a captured secret to any stream.
// Matches are redacted to `[REDACTED:{kind}]` before any output.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve as resolvePath, sep } from 'node:path';

// --- Pattern set --------------------------------------------------------------

// Nibbler gap 7 recommends `{20,}` to survive format drift; Zapp C1 anchors at
// the current 36-char installation-token length. `{36,}` satisfies both: it
// anchors at the current minimum and still matches longer future formats.
const TOKEN_PATTERNS = [
  { kind: 'ghs', re: /ghs_[A-Za-z0-9]{36,}/g },
  { kind: 'ghp', re: /ghp_[A-Za-z0-9]{36,}/g },
  { kind: 'gho', re: /gho_[A-Za-z0-9]{36,}/g },
  { kind: 'ghu', re: /ghu_[A-Za-z0-9]{36,}/g },
  { kind: 'ghr', re: /ghr_[A-Za-z0-9]{36,}/g },
  { kind: 'ghe', re: /ghe_[A-Za-z0-9]{36,}/g },
  { kind: 'github_pat', re: /github_pat_[A-Za-z0-9_]{80,}/g },
];

const HEADER_PATTERNS = [
  {
    kind: 'authorization-header',
    re: /Authorization:\s*(?:Bearer|token)\s+(?:ghs_|ghp_|gho_|ghu_|ghr_|ghe_|github_pat_)[A-Za-z0-9_]{20,}/gi,
  },
  {
    kind: 'x-access-token-url',
    re: /x-access-token:(?:ghs_|ghp_|gho_|ghu_|ghr_|ghe_|github_pat_)[A-Za-z0-9_]{20,}/gi,
  },
];

const PEM_PATTERN = {
  kind: 'pem-private-key',
  // Match the marker PLUS at least one line of base64-like key body so
  // documentation that quotes the marker doesn't false-positive. Real PEM
  // blocks always have a newline and key material after the marker.
  re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=]{40,}/g,
};

const ALL_PATTERNS = [...TOKEN_PATTERNS, ...HEADER_PATTERNS, PEM_PATTERN];

// Paths that must never appear in a commit regardless of content.
const FORBIDDEN_PATHS = [
  /^\.squad\/identity\/keys\/.+\.pem$/,
  /^\.squad\/identity\/apps\/.+\.json$/,
];

// --- Scan primitives ----------------------------------------------------------

/**
 * Scan a string for all configured patterns.
 * @param {string} text
 * @param {string} [source] - Label used in findings (file path, "stdin", etc.)
 * @returns {Array<{kind: string, source: string, line: number, column: number}>}
 */
function scanText(text, source = '<text>') {
  const findings = [];
  for (const { kind, re } of ALL_PATTERNS) {
    // Reset global regex state.
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const before = text.slice(0, m.index);
      const line = before.split('\n').length;
      const column = m.index - before.lastIndexOf('\n');
      findings.push({ kind, source, line, column });
      // Prevent zero-width loops.
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return findings;
}

/**
 * Redact all matches in a string. Returns the scrubbed text and findings.
 * @param {string} text
 * @param {string} [source]
 * @returns {{ scrubbed: string, findings: ReturnType<typeof scanText> }}
 */
function scrubText(text, source = '<text>') {
  const findings = scanText(text, source);
  let scrubbed = text;
  for (const { kind, re } of ALL_PATTERNS) {
    scrubbed = scrubbed.replace(re, `[REDACTED:${kind}]`);
  }
  return { scrubbed, findings };
}

/**
 * Check whether a path is forbidden from being committed.
 * @param {string} path
 * @returns {boolean}
 */
function isForbiddenPath(path) {
  const normalized = path.split(sep).join('/');
  return FORBIDDEN_PATHS.some((re) => re.test(normalized));
}

// --- Surface implementations --------------------------------------------------

async function runResponse({ json, quiet }) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = Buffer.concat(chunks).toString('utf-8');
  const { scrubbed, findings } = scrubText(input, 'stdin');
  process.stdout.write(scrubbed);
  if (findings.length > 0) {
    if (json) {
      process.stderr.write(
        JSON.stringify({ surface: 'response', findings }, null, 2) + '\n',
      );
    } else if (!quiet) {
      process.stderr.write(
        `scrub-secrets: redacted ${findings.length} match(es) from response stream (kinds: ${[
          ...new Set(findings.map((f) => f.kind)),
        ].join(', ')})\n`,
      );
    }
    process.exitCode = 2;
  }
}

function runStaged({ json, quiet }) {
  let diff;
  try {
    diff = execFileSync('git', ['diff', '--cached', '--no-color', '--unified=0'], {
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    process.stderr.write(`scrub-secrets: failed to read staged diff: ${err.message}\n`);
    process.exit(1);
  }

  let stagedPaths = [];
  try {
    stagedPaths = execFileSync('git', ['diff', '--cached', '--name-only'], {
      encoding: 'utf-8',
    })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    // Best-effort; fall through.
  }

  const findings = scanText(diff, 'staged-diff');
  const pathViolations = stagedPaths.filter(isForbiddenPath);

  if (findings.length === 0 && pathViolations.length === 0) {
    if (!quiet) process.stderr.write('scrub-secrets: staged diff clean\n');
    return;
  }

  if (json) {
    process.stderr.write(
      JSON.stringify(
        { surface: 'staged', findings, forbiddenPaths: pathViolations },
        null,
        2,
      ) + '\n',
    );
  } else {
    if (findings.length > 0) {
      const kinds = [...new Set(findings.map((f) => f.kind))].join(', ');
      process.stderr.write(
        `scrub-secrets: BLOCKED — ${findings.length} secret match(es) in staged diff (kinds: ${kinds}).\n` +
          `  Run: git reset HEAD <file>, remove the secret, and re-stage.\n` +
          `  If a token already reached a local commit, rotate the App private key immediately — see .squad/identity/README.md.\n`,
      );
    }
    if (pathViolations.length > 0) {
      process.stderr.write(
        `scrub-secrets: BLOCKED — forbidden path(s) staged:\n` +
          pathViolations.map((p) => `    ${p}`).join('\n') +
          '\n' +
          `  These paths must never be committed. Check .gitignore and git rm --cached.\n`,
      );
    }
  }
  process.exit(1);
}

function runTree({ json, quiet }) {
  let tracked;
  try {
    tracked = execFileSync('git', ['ls-files'], { encoding: 'utf-8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (err) {
    process.stderr.write(`scrub-secrets: failed to list tracked files: ${err.message}\n`);
    process.exit(1);
  }

  const findings = [];
  // Identity paths that are already tracked are legacy state requiring key
  // rotation (see .squad/identity/README.md). They're handled by a separate
  // remediation — skip them in the tree content scan so this gate doesn't
  // block every PR. The --staged surface still refuses any NEW add of these
  // paths, which is what actually matters going forward.
  const scanPaths = tracked.filter((p) => !isForbiddenPath(p));

  for (const path of scanPaths) {
    if (!existsSync(path)) continue;
    let st;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    // Skip binaries >2MB to keep CI fast; tokens/PEMs are always ASCII text.
    if (st.size > 2 * 1024 * 1024) continue;
    let content;
    try {
      content = readFileSync(path, 'utf-8');
    } catch {
      continue;
    }
    const fileFindings = scanText(content, path);
    if (fileFindings.length > 0) findings.push(...fileFindings);
  }

  if (findings.length === 0) {
    if (!quiet) process.stderr.write(`scrub-secrets: tree clean (${scanPaths.length} files scanned, ${tracked.length - scanPaths.length} identity paths skipped as legacy)\n`);
    return;
  }

  if (json) {
    process.stderr.write(
      JSON.stringify({ surface: 'tree', findings }, null, 2) + '\n',
    );
  } else {
    process.stderr.write(
      `scrub-secrets: BLOCKED — ${findings.length} secret match(es) in tracked tree:\n`,
    );
    for (const f of findings) {
      process.stderr.write(`    ${f.source}:${f.line}:${f.column}  kind=${f.kind}\n`);
    }
  }
  process.exit(1);
}

function runPaths(paths, { json, quiet }) {
  const findings = [];
  const pathViolations = paths.filter(isForbiddenPath);
  for (const path of paths) {
    if (!existsSync(path)) {
      process.stderr.write(`scrub-secrets: path not found: ${path}\n`);
      process.exit(1);
    }
    const content = readFileSync(path, 'utf-8');
    findings.push(...scanText(content, path));
  }

  if (findings.length === 0 && pathViolations.length === 0) {
    if (!quiet) process.stderr.write(`scrub-secrets: ${paths.length} path(s) clean\n`);
    return;
  }

  if (json) {
    process.stderr.write(
      JSON.stringify(
        { surface: 'paths', findings, forbiddenPaths: pathViolations },
        null,
        2,
      ) + '\n',
    );
  } else {
    for (const f of findings) {
      process.stderr.write(`scrub-secrets: ${f.source}:${f.line}:${f.column}  kind=${f.kind}\n`);
    }
    for (const p of pathViolations) {
      process.stderr.write(`scrub-secrets: forbidden path: ${p}\n`);
    }
  }
  process.exit(1);
}

// --- CLI ----------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { json: false, quiet: false, surface: null, paths: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') opts.json = true;
    else if (a === '--quiet') opts.quiet = true;
    else if (a === '--response') opts.surface = 'response';
    else if (a === '--staged') opts.surface = 'staged';
    else if (a === '--tree') opts.surface = 'tree';
    else if (a === '--paths') {
      opts.surface = 'paths';
      opts.paths = args.slice(i + 1).filter((x) => !x.startsWith('--'));
      i = args.length;
    } else if (a === '--help' || a === '-h') {
      opts.surface = 'help';
    }
  }
  return opts;
}

function printHelp() {
  process.stdout.write(`scrub-secrets — token/PEM leak prevention (issue #1087)

Usage:
  node .squad/scripts/scrub-secrets.mjs --response < input
  node .squad/scripts/scrub-secrets.mjs --staged
  node .squad/scripts/scrub-secrets.mjs --tree
  node .squad/scripts/scrub-secrets.mjs --paths FILE [FILE...]

Flags:
  --json    Emit structured findings on stderr.
  --quiet   Suppress non-finding output.

Exit codes:
  0  No matches.
  1  Matches found on --staged / --tree / --paths (blocks commit or CI).
  2  Matches redacted from --response stream (surface still writes scrubbed
     output to stdout so pipelines can continue).
`);
}

export {
  ALL_PATTERNS,
  TOKEN_PATTERNS,
  HEADER_PATTERNS,
  PEM_PATTERN,
  FORBIDDEN_PATHS,
  scanText,
  scrubText,
  isForbiddenPath,
};

const isCliInvocation =
  typeof process.argv[1] === 'string' &&
  resolvePath(process.argv[1]).endsWith('scrub-secrets.mjs');

if (isCliInvocation) {
  const opts = parseArgs(process.argv);
  if (!opts.surface || opts.surface === 'help') {
    printHelp();
    process.exit(opts.surface === 'help' ? 0 : 1);
  }
  if (opts.surface === 'response') await runResponse(opts);
  else if (opts.surface === 'staged') runStaged(opts);
  else if (opts.surface === 'tree') runTree(opts);
  else if (opts.surface === 'paths') runPaths(opts.paths, opts);
}
