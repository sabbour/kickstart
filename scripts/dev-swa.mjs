#!/usr/bin/env node
// Launch the SWA CLI emulator with AAD settings loaded from the API's
// local.settings.json. Needed because we run `func` separately (via
// --api-devserver-url), so swa never loads that file itself.

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const settingsPath = resolve(here, '../packages/web/api/local.settings.json');

let values = {};
try {
  values = JSON.parse(readFileSync(settingsPath, 'utf8')).Values ?? {};
} catch (err) {
  console.warn(`[dev-swa] Could not read ${settingsPath}: ${err.message}`);
}

const env = { ...process.env };
for (const key of ['AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_TENANT_ID']) {
  if (values[key] && !env[key]) env[key] = values[key];
}

/** Try to bind a port; resolves true if available, false if in use. */
function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
  });
}

/** Find a free port starting from `start`, trying up to `maxAttempts` ports. */
async function findFreePort(start, maxAttempts = 10) {
  for (let port = start; port < start + maxAttempts; port++) {
    if (await isPortFree(port)) return port;
  }
  return null;
}

/**
 * Health-check: wait for a URL to respond with HTTP 2xx.
 * Retries up to `maxAttempts` times with `intervalMs` between attempts.
 */
async function waitForHealthy(url, { maxAttempts = 10, intervalMs = 2000, label = url } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        console.log(`[dev-swa] ✓ ${label} is ready (attempt ${attempt}/${maxAttempts})`);
        return true;
      }
    } catch { /* not ready yet */ }
    if (attempt < maxAttempts) {
      console.log(`[dev-swa] Waiting for ${label}… (attempt ${attempt}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  console.error(`[dev-swa] ✗ ${label} did not become healthy after ${maxAttempts} attempts`);
  return false;
}

const DEFAULT_PORT = Number(process.env.SWA_CLI_PORT) || 4280;

const port = await findFreePort(DEFAULT_PORT);
if (!port) {
  console.error(`[dev-swa] No free port found in range ${DEFAULT_PORT}–${DEFAULT_PORT + 9}. Aborting.`);
  process.exit(1);
}
if (port !== DEFAULT_PORT) {
  console.warn(`[dev-swa] Port ${DEFAULT_PORT} is in use, starting on port ${port} instead.`);
}
console.log(`[dev-swa] SWA emulator → http://localhost:${port}/`);

const args = [
  'swa',
  'start',
  'http://localhost:5173',
  '--api-devserver-url',
  'http://localhost:7071',
  '--port',
  String(port),
];

const child = spawn('npx', args, { stdio: 'inherit', env });

// Health-check after SWA starts — verify Vite and Functions hosts
child.on('spawn', async () => {
  const viteOk = await waitForHealthy('http://localhost:5173', { label: 'Vite dev server' });
  const funcOk = await waitForHealthy('http://localhost:7071/api/health', { label: 'Functions host' });
  if (!viteOk || !funcOk) {
    console.error('[dev-swa] One or more upstream servers failed health check. SWA may not work correctly.');
    console.error('[dev-swa] Ensure Vite (port 5173) and Azure Functions (port 7071) are running.');
  }
});

child.on('exit', (code) => process.exit(code ?? 0));
