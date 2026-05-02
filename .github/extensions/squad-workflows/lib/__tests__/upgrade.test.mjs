// Tests for upgrade.mjs — happy path and error-path error detail preservation.
// Uses vi.mock to stub node:child_process and node:fs so no real npm calls are made.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function loadMocks() {
  const { execFileSync } = await import('node:child_process');
  const { readFileSync } = await import('node:fs');
  return { execFileSync: vi.mocked(execFileSync), readFileSync: vi.mocked(readFileSync) };
}

async function freshRunUpgrade() {
  vi.resetModules();
  const { runUpgrade } = await import('../upgrade.mjs');
  return runUpgrade;
}

// Force global install mode by clearing npm exec env vars for the duration of a test.
function forceGlobalMode() {
  const saved = { npm_command: process.env.npm_command, npm_execpath: process.env.npm_execpath };
  process.env.npm_command = '';
  process.env.npm_execpath = '/usr/local/bin/npm'; // non-npx path
  return () => {
    process.env.npm_command = saved.npm_command ?? '';
    process.env.npm_execpath = saved.npm_execpath ?? '';
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('upgrade.mjs — runUpgrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path (global mode, version bumped) — logs success and does not throw', async () => {
    const restore = forceGlobalMode();
    try {
      const { execFileSync, readFileSync } = await loadMocks();

      readFileSync.mockImplementation((p) => {
        const ps = String(p);
        // readVersion: the module's own package.json
        if (ps.endsWith('squad-workflows/package.json') || ps.includes('squad-workflows')) {
          return JSON.stringify({ version: '1.1.0' });
        }
        if (ps.endsWith('package.json')) return JSON.stringify({ version: '1.0.0' });
        throw new Error(`Unexpected readFileSync: ${ps}`);
      });

      execFileSync.mockImplementation((_cmd, args) => {
        if (args.includes('root')) return '/usr/local/lib/node_modules\n';
        return undefined; // npm install -g (stdio: inherit)
      });

      const runUpgrade = await freshRunUpgrade();
      const logs = [];
      const origLog = console.log;
      console.log = (...a) => logs.push(a.join(' '));
      try {
        await expect(runUpgrade()).resolves.toBeUndefined();
      } finally {
        console.log = origLog;
      }
      expect(logs.some((l) => l.includes('1.0.0') && l.includes('1.1.0'))).toBe(true);
    } finally {
      restore();
    }
  });

  it('happy path (global mode, already on latest) — logs already-on-latest', async () => {
    const restore = forceGlobalMode();
    try {
      const { execFileSync, readFileSync } = await loadMocks();

      readFileSync.mockImplementation((p) => {
        return JSON.stringify({ version: '1.1.0' });
      });

      execFileSync.mockImplementation((_cmd, args) => {
        if (args.includes('root')) return '/usr/local/lib/node_modules\n';
        return undefined;
      });

      const runUpgrade = await freshRunUpgrade();
      const logs = [];
      const origLog = console.log;
      console.log = (...a) => logs.push(a.join(' '));
      try {
        await expect(runUpgrade()).resolves.toBeUndefined();
      } finally {
        console.log = origLog;
      }
      expect(logs.some((l) => l.includes('Already on latest'))).toBe(true);
    } finally {
      restore();
    }
  });

  it('error path — thrown Error preserves original error message in rethrow', async () => {
    const restore = forceGlobalMode();
    try {
      const { execFileSync, readFileSync } = await loadMocks();

      readFileSync.mockImplementation(() => JSON.stringify({ version: '1.0.0' }));
      execFileSync.mockImplementation((_cmd, args) => {
        if (args.includes('root')) return '/usr/local/lib/node_modules\n';
        throw new Error('EACCES: permission denied, open /usr/local/lib/node_modules');
      });

      const runUpgrade = await freshRunUpgrade();
      // The rethrown error must include both the wrapper text AND the original cause
      await expect(runUpgrade()).rejects.toThrow('Upgrade failed:');
      await expect(runUpgrade()).rejects.toThrow('EACCES: permission denied');
      await expect(runUpgrade()).rejects.toThrow('npm install -g');
    } finally {
      restore();
    }
  });

  it('error path — non-Error thrown value is also surfaced', async () => {
    const restore = forceGlobalMode();
    try {
      const { execFileSync, readFileSync } = await loadMocks();

      readFileSync.mockImplementation(() => JSON.stringify({ version: '1.0.0' }));
      execFileSync.mockImplementation((_cmd, args) => {
        if (args.includes('root')) return '/usr/local/lib/node_modules\n';
        // eslint-disable-next-line no-throw-literal
        throw 'SIGKILL';
      });

      const runUpgrade = await freshRunUpgrade();
      await expect(runUpgrade()).rejects.toThrow('SIGKILL');
    } finally {
      restore();
    }
  });
});
