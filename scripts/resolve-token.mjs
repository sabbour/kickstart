#!/usr/bin/env node
/**
 * resolve-token.mjs — Resolve a GitHub App installation token for a role.
 * Usage: node scripts/resolve-token.mjs <role>
 * Outputs the token to stdout (no newline). Errors go to stderr.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSign } from 'node:crypto';
import { request } from 'node:https';

const role = process.argv[2];
if (!role) { process.stderr.write('Usage: node resolve-token.mjs <role>\n'); process.exit(1); }

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const appConfig = JSON.parse(readFileSync(resolve(root, `.squad/identity/apps/${role}.json`), 'utf8'));
const pem = readFileSync(resolve(root, `.squad/identity/keys/${role}.pem`), 'utf8');

// Build JWT (RS256, 9-min expiry for WSL clock skew safety)
const now = Math.floor(Date.now() / 1000);
const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(JSON.stringify({ iss: String(appConfig.appId), iat: now - 60, exp: now + 540 })).toString('base64url');
const sign = createSign('RSA-SHA256');
sign.update(`${header}.${payload}`);
const signature = sign.sign(pem, 'base64url');
const jwt = `${header}.${payload}.${signature}`;

// Exchange JWT for installation token
const options = {
  hostname: 'api.github.com',
  path: `/app/installations/${appConfig.installationId}/access_tokens`,
  method: 'POST',
  headers: {
    Authorization: `Bearer ${jwt}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'squad-identity-test',
    'X-GitHub-Api-Version': '2022-11-28',
  },
};

const req = request(options, (res) => {
  let data = '';
  res.on('data', (c) => (data += c));
  res.on('end', () => {
    try {
      const j = JSON.parse(data);
      if (j.token) process.stdout.write(j.token);
      else { process.stderr.write(`Token exchange failed: ${JSON.stringify(j).slice(0, 300)}\n`); process.exit(1); }
    } catch (e) { process.stderr.write(`Parse error: ${e.message}\n`); process.exit(1); }
  });
});
req.on('error', (e) => { process.stderr.write(`Request error: ${e.message}\n`); process.exit(1); });
req.end();
