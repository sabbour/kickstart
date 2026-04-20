#!/usr/bin/env node
// Launch the SWA CLI emulator with AAD settings loaded from the API's
// local.settings.json. Needed because we run `func` separately (via
// --api-devserver-url), so swa never loads that file itself.

import { spawn } from 'node:child_process';
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

const args = [
  'swa',
  'start',
  'http://localhost:5173',
  '--api-devserver-url',
  'http://localhost:7071',
  '--port',
  '4280',
];

const child = spawn('npx', args, { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
