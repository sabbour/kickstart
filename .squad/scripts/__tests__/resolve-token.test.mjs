import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'resolve-token.mjs');

// Nibbler gap / non-blocking recommendation: lock in the `--required` fail-closed
// contract so a future refactor can't quietly regress to ambient-auth fallback.

describe('resolve-token.mjs --required (fail-closed contract)', () => {
  it('exits non-zero with zero stdout for an unknown role', () => {
    let threw = false;
    let stdout = '';
    let stderr = '';
    try {
      stdout = execFileSync('node', [SCRIPT, '--required', 'definitely-not-a-role'], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      threw = true;
      stdout = (err.stdout ?? Buffer.from('')).toString();
      stderr = (err.stderr ?? Buffer.from('')).toString();
      expect(err.status).toBe(1);
    }
    expect(threw).toBe(true);
    expect(stdout).toBe('');
    expect(stderr.toLowerCase()).toContain('no github app mapping');
  });

  it('without --required still exits zero for unknown role but emits no stdout', () => {
    const stdout = execFileSync('node', [SCRIPT, 'definitely-not-a-role'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    expect(stdout).toBe('');
  });
});
