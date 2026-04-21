#!/usr/bin/env node
/**
 * Bundle-size regression lock for `packages/web`.
 *
 * Background: PR #1000 landed pack renderers (azure/aks/github) on the client,
 * which pushed the eager `index.js` chunk up by ~14 KB gzipped — above the
 * prior ≤+10 KB advisory. Nibbler signed off on the overage provided we add a
 * CI gate that locks the bundle at the new size so any *further* regression
 * fails the build loudly.
 *
 * Wired as a `postbuild` script in packages/web/package.json so it runs on
 * every `npm run build`, including the CI e2e job's monorepo build. No
 * dedicated workflow needed.
 *
 * Scope: we measure only the chunks that actually contain pack renderer code
 * today — the main `index-*.js` entry and the `Playground-*.js` route chunk.
 * Vendor workers (monaco `ts.worker`), mermaid diagram chunks, and other
 * lazy-loaded fragments are deliberately *not* budgeted here: they are
 * unaffected by pack wiring and have their own (much larger) size profile.
 *
 * Ceilings sit just above the measured post-#1000 gzipped size so the current
 * build passes. Raising a ceiling requires a deliberate edit here and a
 * `bundle-budget-waiver:` line in the PR description.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '..', 'dist');
const assetsDir = resolve(distDir, 'assets');

// Budgeted chunks. Each entry pairs a prefix matcher with a gzipped ceiling.
// Measured post-#1000: index ≈ 228 642 gz, Playground ≈ 39 613 gz.
const BUDGETS = [
  { label: 'main entry', prefix: 'index-', suffix: '.js', maxGz: 260_000 },
  { label: 'playground route', prefix: 'Playground-', suffix: '.js', maxGz: 60_000 },
];

function listJsChunks(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith('.js'))
      .map((name) => join(dir, name));
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
}

function gzSize(filePath) {
  return gzipSync(readFileSync(filePath)).length;
}

const chunks = listJsChunks(assetsDir);
if (chunks.length === 0) {
  console.error(
    `[bundle-budget] no JS chunks found under ${assetsDir}. Did \`vite build\` succeed?`,
  );
  process.exit(2);
}

const fmt = (n) => n.toLocaleString('en-US');
const report = [];
const failures = [];

for (const budget of BUDGETS) {
  const matches = chunks.filter((path) => {
    const base = path.split('/').pop();
    return base.startsWith(budget.prefix) && base.endsWith(budget.suffix);
  });
  if (matches.length === 0) {
    failures.push(`no chunk matched ${budget.prefix}*${budget.suffix} (budget: ${budget.label})`);
    continue;
  }
  if (matches.length > 1) {
    failures.push(
      `expected exactly one ${budget.label} chunk, found ${matches.length}: ${matches.join(', ')}`,
    );
    continue;
  }
  const file = matches[0];
  const raw = statSync(file).size;
  const gz = gzSize(file);
  const rel = file.replace(distDir + '/', '');
  report.push({ label: budget.label, file: rel, raw, gz, maxGz: budget.maxGz });
  if (gz > budget.maxGz) {
    failures.push(
      `${budget.label} chunk ${rel} = ${fmt(gz)} gz exceeds ceiling ${fmt(budget.maxGz)}`,
    );
  }
}

console.log('Bundle budget report (packages/web)');
console.log('-----------------------------------');
console.log(
  'label'.padEnd(20),
  'chunk'.padEnd(40),
  'raw'.padStart(12),
  'gzip'.padStart(12),
  'ceiling'.padStart(12),
);
for (const m of report) {
  console.log(
    m.label.padEnd(20),
    m.file.padEnd(40),
    fmt(m.raw).padStart(12),
    fmt(m.gz).padStart(12),
    fmt(m.maxGz).padStart(12),
  );
}

console.log('');
console.log(
  JSON.stringify({
    budgets: report,
    pass: failures.length === 0,
  }),
);

if (failures.length > 0) {
  console.error('');
  console.error('[bundle-budget] FAIL:');
  for (const f of failures) console.error('  -', f);
  console.error(
    '\nIf intentional, raise the relevant ceiling in scripts/check-bundle-budget.mjs',
  );
  console.error(
    'and document the new size in the PR description as `bundle-budget-waiver:`.',
  );
  process.exit(1);
}
