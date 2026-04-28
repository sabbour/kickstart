/**
 * CI invariant guards for issue #237 (ARM direct migration, PR-1).
 *
 * These tests run as part of `npx vitest run` — the same step that gates
 * every PR. They hard-fail CI if:
 *
 *   1. The SWA `connect-src` CSP directive stops including
 *      `https://management.azure.com` — the live app would silently break
 *      because the browser can no longer reach ARM.
 *   2. The Playwright CSP smoke mirror drifts away from the SWA config.
 *   3. Any production source file (excluding the proxy implementation
 *      itself and tests) references the legacy `/api/arm-proxy` route.
 *      PR-1 of #237 requires zero callers; PR-2 will delete the proxy.
 *
 * These three invariants together satisfy Nibbler's PR-1 conditions #2
 * (zero `request()` ARM callers remain) and #3 (hard-fail CSP CI check).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../../../..');

const SWA_CONFIG_PATH = join(REPO_ROOT, 'packages/web/public/staticwebapp.config.json');
const E2E_CSP_SPEC_PATH = join(REPO_ROOT, 'packages/web/e2e/browser-telemetry.spec.ts');

interface SwaConfig {
  globalHeaders?: Record<string, string>;
}

function readSwaCsp(): string {
  const raw = readFileSync(SWA_CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw) as SwaConfig;
  const csp = parsed.globalHeaders?.['Content-Security-Policy'];
  if (!csp) {
    throw new Error('staticwebapp.config.json has no Content-Security-Policy header');
  }
  return csp;
}

function getConnectSrc(csp: string): string {
  const directive = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('connect-src'));
  if (!directive) {
    throw new Error('CSP has no connect-src directive');
  }
  return directive;
}

describe('issue #237 — CSP allows direct ARM (hard-fail CI guard)', () => {
  it('staticwebapp.config.json connect-src includes https://management.azure.com', () => {
    const csp = readSwaCsp();
    const connectSrc = getConnectSrc(csp);
    expect(
      connectSrc,
      'connect-src is missing https://management.azure.com — direct ARM calls (issue #237) will be blocked.',
    ).toContain('https://management.azure.com');
  });

  it('Playwright CSP smoke mirror in browser-telemetry.spec.ts also includes https://management.azure.com', () => {
    const spec = readFileSync(E2E_CSP_SPEC_PATH, 'utf8');
    expect(
      spec,
      'CSP smoke mirror in browser-telemetry.spec.ts is out of sync with staticwebapp.config.json — must include https://management.azure.com.',
    ).toContain('https://management.azure.com');
  });
});

// ---------------------------------------------------------------------------
// Zero /api/arm-proxy callers in production code.
// ---------------------------------------------------------------------------

const SCAN_ROOTS = ['packages'];
const SCAN_EXTS = new Set(['.ts', '.tsx']);

const ALLOWED_FILES = new Set<string>([
  // The proxy implementation itself (kept live for one week as rollback
  // safety net before PR-2 deletes it).
  'packages/web/api/src/functions/arm-proxy.ts',
  // The proxy allowlist that registers arm-proxy → management.azure.com.
  'packages/web/api/src/lib/proxy-allowlist.ts',
  // This guard test — references the route as a string for grep.
  'packages/web/api/src/__guards__/arm-direct-csp.test.ts',
]);

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (st.isFile()) {
      yield full;
    }
  }
}

function isProductionFile(relPath: string): boolean {
  if (relPath.includes('__tests__')) return false;
  if (/\.test\.(ts|tsx)$/.test(relPath)) return false;
  if (/\.spec\.(ts|tsx)$/.test(relPath)) return false;
  if (relPath.includes('/e2e/')) return false;
  return true;
}

const ROUTE_LITERAL_REGEX = /['"`]\/api\/arm-proxy/;

describe('issue #237 — zero /api/arm-proxy callers (hard-fail CI guard)', () => {
  it('no production source file references the legacy /api/arm-proxy route', () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      const absRoot = join(REPO_ROOT, root);
      for (const file of walk(absRoot)) {
        const ext = file.slice(file.lastIndexOf('.'));
        if (!SCAN_EXTS.has(ext)) continue;

        const rel = relative(REPO_ROOT, file).replaceAll('\\', '/');
        if (ALLOWED_FILES.has(rel)) continue;
        if (!isProductionFile(rel)) continue;

        const contents = readFileSync(file, 'utf8');
        if (ROUTE_LITERAL_REGEX.test(contents)) {
          offenders.push(rel);
        }
      }
    }

    expect(
      offenders,
      `Production source files still reference /api/arm-proxy — PR-1 of #237 requires zero callers:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
