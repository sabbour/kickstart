#!/usr/bin/env node
/**
 * CSP regression guard for browser-direct ARM (Wave 2 / issue #319, parent #237).
 *
 * Parses `packages/web/public/staticwebapp.config.json`, locates the
 * `Content-Security-Policy` header in `globalHeaders`, extracts the
 * `connect-src` directive, and **hard-fails** if any required origin is
 * missing.
 *
 * Required origins (today):
 *   - https://management.azure.com  (Option A2 browser-direct ARM)
 *
 * Add new required origins to REQUIRED_CONNECT_SRC below as future browser
 * services come online. The intent of this gate is to block CSP regressions
 * that would silently break browser-direct calls in production.
 *
 * Wired by `.github/workflows/csp-check.yml` on every PR touching
 * CSP-owning files. Exits non-zero on any violation; the workflow is
 * non-bypassable (no `continue-on-error`).
 *
 * Enforcement model and escalation path: docs/operations/csp-enforcement.md
 *
 * Run locally:  node packages/web/scripts/check-csp.mjs
 *
 * Docs: docs-site/docs/operations/csp-enforcement.md
 *   — canonical enforcement location, escalation path, and owner SLAs.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '..', 'public', 'staticwebapp.config.json');

const REQUIRED_CONNECT_SRC = [
  'https://management.azure.com',
];

function fail(msg) {
  console.error(`\n❌ CSP check failed: ${msg}\n`);
  console.error(`File: ${CONFIG_PATH}`);
  console.error(`This gate exists to prevent regressions in browser-direct ARM (issue #319, epic #237).`);
  console.error(`If you intentionally removed an origin, update REQUIRED_CONNECT_SRC in this script and document why.\n`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
} catch (err) {
  fail(`could not read or parse ${CONFIG_PATH}: ${err.message}`);
}

const csp = config?.globalHeaders?.['Content-Security-Policy'];
if (typeof csp !== 'string' || csp.length === 0) {
  fail(`globalHeaders["Content-Security-Policy"] is missing or empty.`);
}

// Parse CSP directives: "name value1 value2; name value1 ..."
const directives = new Map();
for (const raw of csp.split(';')) {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) continue;
  const [name, ...values] = parts;
  directives.set(name.toLowerCase(), values);
}

const connectSrc = directives.get('connect-src');
if (!connectSrc) {
  fail(`CSP has no \`connect-src\` directive. Browser-direct ARM calls would fall back to \`default-src\` and may be blocked unless that directive allows the required origin(s).`);
}

const missing = REQUIRED_CONNECT_SRC.filter(origin => !connectSrc.includes(origin));
if (missing.length > 0) {
  fail(
    `\`connect-src\` is missing required origin(s): ${missing.join(', ')}.\n` +
    `Current connect-src: ${connectSrc.join(' ')}`
  );
}

console.log(`✅ CSP check passed: connect-src includes ${REQUIRED_CONNECT_SRC.join(', ')}`);

// TODO(#348): If the project adopts non-globalHeaders CSP enforcement locations, extend this
// script to scan those locations. Planned future scanners:
//   1. <meta http-equiv="Content-Security-Policy"> in packages/web/public/index.html / built HTML
//   2. Server-set CSP headers if a proxy or custom origin fronts the SWA
// Each scanner must validate connect-src includes required origins (REQUIRED_CONNECT_SRC).
// Do NOT implement until the corresponding CSP location is actually adopted.
// See docs/operations/csp-enforcement.md § Future Scope for details.
