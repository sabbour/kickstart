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
child.on('exit', (code) => process.exit(code ?? 0));
