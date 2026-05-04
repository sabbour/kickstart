/**
 * Unit test for the CSP regression guard (issue #319, parent #237).
 *
 * Validates that `packages/web/scripts/check-csp.mjs` parses
 * `staticwebapp.config.json`'s CSP correctly and hard-fails when the
 * `connect-src` directive omits required origins.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..', '..');
const scriptPath = resolve(repoRoot, 'packages/web/scripts/check-csp.mjs');
const configPath = resolve(repoRoot, 'packages/web/public/staticwebapp.config.json');

function runScriptAgainst(configJsonString: string) {
  // Stage a sandbox that mimics the script's expected layout
  // (packages/web/scripts + packages/web/public/staticwebapp.config.json).
  const sandbox = mkdtempSync(join(tmpdir(), 'csp-check-'));
  try {
    const publicDir = join(sandbox, 'public');
    const scriptsDir = join(sandbox, 'scripts');
    mkdirSync(publicDir, { recursive: true });
    mkdirSync(scriptsDir, { recursive: true });
    writeFileSync(join(publicDir, 'staticwebapp.config.json'), configJsonString);
    cpSync(scriptPath, join(scriptsDir, 'check-csp.mjs'));

    const result = spawnSync(process.execPath, [join(scriptsDir, 'check-csp.mjs')], {
      encoding: 'utf-8',
    });
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

describe('CSP regression guard (check-csp.mjs)', () => {
  it('passes for the real staticwebapp.config.json shipped in the repo', () => {
    const result = spawnSync(process.execPath, [scriptPath], { encoding: 'utf-8' });
    expect(result.status, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/CSP check passed/);
  });

  it('asserts the live CSP includes management.azure.com in connect-src', () => {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const csp: string = config.globalHeaders['Content-Security-Policy'];
    const connectDirective = csp
      .split(';')
      .map(d => d.trim())
      .find(d => d.toLowerCase().startsWith('connect-src'));
    expect(connectDirective, 'connect-src directive must exist').toBeDefined();
    expect(connectDirective).toMatch(/https:\/\/management\.azure\.com(\s|$)/);
  });

  it('hard-fails when connect-src is missing https://management.azure.com', () => {
    const bad = {
      globalHeaders: {
        'Content-Security-Policy':
          "default-src 'self'; connect-src 'self' https://example.com",
      },
    };
    const result = runScriptAgainst(JSON.stringify(bad));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/management\.azure\.com/);
  });

  it('hard-fails when the connect-src directive is absent entirely', () => {
    const bad = {
      globalHeaders: {
        'Content-Security-Policy': "default-src 'self'",
      },
    };
    const result = runScriptAgainst(JSON.stringify(bad));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/connect-src/);
  });

  it('hard-fails when the CSP header is missing', () => {
    const bad = { globalHeaders: {} };
    const result = runScriptAgainst(JSON.stringify(bad));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Content-Security-Policy/i);
  });
});
