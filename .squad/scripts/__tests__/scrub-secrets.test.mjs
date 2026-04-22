import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanText,
  scrubText,
  isForbiddenPath,
  TOKEN_PATTERNS,
  HEADER_PATTERNS,
  PEM_PATTERN,
} from '../scrub-secrets.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(__dirname, '..', '..', 'runtime', 'test-fixtures');

// These fixtures are synthetic — 36 arbitrary characters, never real tokens.
const FAKE_GHS = 'ghs_' + 'A'.repeat(36);
const FAKE_GHP = 'ghp_' + 'B'.repeat(36);
const FAKE_GHO = 'gho_' + 'C'.repeat(36);
const FAKE_GHU = 'ghu_' + 'D'.repeat(36);
const FAKE_GHR = 'ghr_' + 'E'.repeat(36);
const FAKE_GHE = 'ghe_' + 'F'.repeat(36);
const FAKE_PAT = 'github_pat_' + 'Z'.repeat(82);

describe('scrub-secrets / pattern set', () => {
  it('matches every GitHub token prefix (Zapp C1, Nibbler gap 7)', () => {
    const blob = [FAKE_GHS, FAKE_GHP, FAKE_GHO, FAKE_GHU, FAKE_GHR, FAKE_GHE, FAKE_PAT].join(' ');
    const findings = scanText(blob);
    const kinds = new Set(findings.map((f) => f.kind));
    expect(kinds.has('ghs')).toBe(true);
    expect(kinds.has('ghp')).toBe(true);
    expect(kinds.has('gho')).toBe(true);
    expect(kinds.has('ghu')).toBe(true);
    expect(kinds.has('ghr')).toBe(true);
    expect(kinds.has('ghe')).toBe(true);
    expect(kinds.has('github_pat')).toBe(true);
  });

  it('matches Authorization header forms (Bearer + token)', () => {
    const bearer = `Authorization: Bearer ${FAKE_GHS}`;
    const tokenH = `authorization: token ${FAKE_GHP}`;
    const findings = [...scanText(bearer), ...scanText(tokenH)];
    expect(findings.some((f) => f.kind === 'authorization-header')).toBe(true);
  });

  it('matches x-access-token URL form', () => {
    const url = `https://x-access-token:${FAKE_GHS}@github.com/o/r.git`;
    const findings = scanText(url);
    expect(findings.some((f) => f.kind === 'x-access-token-url')).toBe(true);
  });

  it('matches PEM private key block markers with body (docs-quote-safe)', () => {
    const body = 'A'.repeat(64) + '\n' + 'B'.repeat(64);
    const pems = [
      '-----BEGIN PRIVATE KEY-----',
      '-----BEGIN RSA PRIVATE KEY-----',
      '-----BEGIN EC PRIVATE KEY-----',
      '-----BEGIN DSA PRIVATE KEY-----',
      '-----BEGIN OPENSSH PRIVATE KEY-----',
      '-----BEGIN ENCRYPTED PRIVATE KEY-----',
    ];
    for (const marker of pems) {
      const realPem = `${marker}\n${body}\n-----END PRIVATE KEY-----`;
      const f = scanText(realPem);
      expect(f.length, marker).toBeGreaterThan(0);
      expect(f[0].kind).toBe('pem-private-key');
    }
  });

  it('does NOT match bare PEM marker in documentation prose', () => {
    const doc =
      'Do not paste `-----BEGIN RSA PRIVATE KEY-----` substrings into chat.\n' +
      'This line references the marker but carries no key body.';
    const findings = scanText(doc);
    expect(findings.filter((f) => f.kind === 'pem-private-key')).toEqual([]);
  });

  it('does not match short or non-token strings', () => {
    const benign = 'ghs_tooShort ghostwriter gho_xyz normal text';
    expect(scanText(benign)).toEqual([]);
  });

  it('scrubText redacts matches and never emits the raw secret', () => {
    const input = `Log entry\nAuthorization: Bearer ${FAKE_GHS}\ndone\n`;
    const { scrubbed, findings } = scrubText(input, 'test');
    expect(findings.length).toBeGreaterThan(0);
    expect(scrubbed).not.toContain(FAKE_GHS);
    expect(scrubbed).toContain('[REDACTED:');
  });

  it('TOKEN/HEADER/PEM pattern exports are populated', () => {
    expect(TOKEN_PATTERNS.length).toBeGreaterThanOrEqual(7);
    expect(HEADER_PATTERNS.length).toBeGreaterThanOrEqual(2);
    expect(PEM_PATTERN.kind).toBe('pem-private-key');
  });
});

describe('scrub-secrets / forbidden paths (Zapp C9)', () => {
  it('flags identity key and app-registration paths', () => {
    expect(isForbiddenPath('.squad/identity/keys/lead.pem')).toBe(true);
    expect(isForbiddenPath('.squad/identity/apps/frontend.json')).toBe(true);
  });

  it('does not flag benign paths', () => {
    expect(isForbiddenPath('.squad/agents/fry/charter.md')).toBe(false);
    expect(isForbiddenPath('README.md')).toBe(false);
    expect(isForbiddenPath('.squad/identity/README.md')).toBe(false);
  });
});

describe('scrub-secrets --tree / tracked forbidden paths are hard failures (Nibbler PR #1091 RF1)', () => {
  it('fails loudly if a matching path is tracked in HEAD', () => {
    mkdirSync(FIXTURE_ROOT, { recursive: true });
    const root = mkdtempSync(join(FIXTURE_ROOT, 'scrub-'));
    try {
      execFileSync('git', ['init', '-q', root]);
      execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
      execFileSync('git', ['-C', root, 'config', 'user.name', 'test']);
      mkdirSync(join(root, '.squad', 'identity', 'keys'), { recursive: true });
      writeFileSync(join(root, '.squad', 'identity', 'keys', 'fake.pem'), 'placeholder\n');
      writeFileSync(join(root, 'README.md'), '# test\n');
      execFileSync('git', ['-C', root, 'add', '-A']);
      execFileSync('git', ['-C', root, 'commit', '-q', '-m', 'init']);
      const scriptPath = join(__dirname, '..', 'scrub-secrets.mjs');
      let threw = false;
      let stderr = '';
      try {
        execFileSync('node', [scriptPath, '--tree'], {
          cwd: root,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err) {
        threw = true;
        stderr = (err.stderr ?? Buffer.from('')).toString();
        expect(err.status).toBe(1);
      }
      expect(threw).toBe(true);
      expect(stderr).toMatch(/forbidden path/i);
      expect(stderr).toContain('.squad/identity/keys/fake.pem');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
