/**
 * Unit tests for packages/web/api/src/startup/packs.ts
 *
 * Covers all 5 Nibbler-required test cases (PR-blocking):
 *  1. Multiple bad packs → loadErrors[] has all entries
 *  2. Happy-path regression → getLoadErrors() returns []
 *  3. Error sanitization — no raw strings or file paths in loadErrors
 *  4. getLoadErrors() resets when registry rebuilds
 *  5. registry.seal() failure propagates as hard stop
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError, ZodIssueCode } from 'zod';

// ── Hoist mock variables so vi.mock factories can reference them ─────────────

const { mockRegister, mockSeal } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockSeal: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@aks-kickstart/harness/runtime/registry', () => ({
  PackRegistry: class {
    register = mockRegister;
    seal = mockSeal;
    get components() { return []; }
    get catalog() { return { userActions: [] }; }
    get playgroundScenarios() { return []; }
  },
}));

vi.mock('./credentials.js', () => ({
  getCredentialConfig: vi.fn(() => ({ provider: 'azure-openai' })),
}));

// Pack imports — each returns a minimal stub (name only; registry never reads further)
vi.mock('../../../../pack-core/src/server-manifest.js', () => ({
  corePackServer: { name: 'core', version: '0.1.0' },
}));
vi.mock('../../../../pack-azure/src/server-manifest.js', () => ({
  azurePackServer: { name: 'azure', version: '0.1.0' },
}));
vi.mock('../../../../pack-aks-automatic/src/server-manifest.js', () => ({
  aksAutomaticPackServer: { name: 'aks', version: '0.1.0' },
}));
vi.mock('../../../../pack-github/src/server-manifest.js', () => ({
  githubPackServer: { name: 'github', version: '0.1.0' },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeZodError(): ZodError {
  return new ZodError([
    {
      code: ZodIssueCode.invalid_type,
      path: ['version'],
      message: 'Expected string, received undefined',
      expected: 'string',
      received: 'undefined',
    },
  ]);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('packs startup — getRegistry() fail-soft', () => {
  beforeEach(async () => {
    mockRegister.mockReset();
    mockSeal.mockReset();
    // Re-import to reset module-scope state (_registry, _loadErrors)
    vi.resetModules();
  });

  // ── Nibbler test 1: multiple bad packs → all in loadErrors[] ─────────────

  it('quarantines multiple bad non-core packs and records all in loadErrors', async () => {
    const azureErr = new Error('azure manifest loading failed');
    const githubZodErr = makeZodError();

    mockRegister.mockImplementation((pack: { name: string }) => {
      if (pack.name === 'azure') throw azureErr;
      if (pack.name === 'github') throw githubZodErr;
      // core and aks succeed
    });
    mockSeal.mockReturnValue(undefined);

    const { getRegistry, getLoadErrors } = await import('./packs.js');
    const registry = getRegistry();

    expect(registry).toBeDefined();

    const errors = getLoadErrors();
    expect(errors).toHaveLength(2);
    expect(errors.find(e => e.packId === 'azure')).toBeDefined();
    expect(errors.find(e => e.packId === 'github')).toBeDefined();
    // Schema validation reason for ZodError
    expect(errors.find(e => e.packId === 'github')?.reason).toBe('schema_validation');
    // Generic error → unknown
    expect(errors.find(e => e.packId === 'azure')?.reason).toBe('unknown');
  });

  // ── Nibbler test 2: happy path → loadErrors empty ────────────────────────

  it('returns empty loadErrors when all packs load cleanly', async () => {
    mockRegister.mockReturnValue(undefined);
    mockSeal.mockReturnValue(undefined);

    const { getRegistry, getLoadErrors } = await import('./packs.js');
    const registry = getRegistry();

    expect(registry).toBeDefined();
    expect(getLoadErrors()).toEqual([]);
  });

  // ── Nibbler test 3: error sanitization — no raw strings in loadErrors ─────

  it('does not expose raw error messages or file paths in loadErrors entries', async () => {
    const sensitiveErr = new Error(
      'ZodError: unrecognized_keys at /home/site/wwwroot/api/dist/functions/pack-assets/azure/skills/bicep-authoring.SKILL.md',
    );

    mockRegister.mockImplementation((pack: { name: string }) => {
      if (pack.name === 'azure') throw sensitiveErr;
    });
    mockSeal.mockReturnValue(undefined);

    const { getRegistry, getLoadErrors } = await import('./packs.js');
    getRegistry();

    const errors = getLoadErrors();
    expect(errors).toHaveLength(1);
    const entry = errors[0]!;

    // loadErrors entries only have packId and reason — no error message, no path
    expect(Object.keys(entry)).toEqual(['packId', 'reason']);
    expect(entry.packId).toBe('azure');
    expect(['schema_validation', 'parse_error', 'unknown']).toContain(entry.reason);

    // Critically: no raw error content anywhere in the serialised entry
    const serialised = JSON.stringify(entry);
    expect(serialised).not.toContain('/home/');
    expect(serialised).not.toContain('wwwroot');
    expect(serialised).not.toContain('ZodError');
    expect(serialised).not.toContain('unrecognized_keys');
  });

  // ── Nibbler test 4: getLoadErrors() resets when registry rebuilds ─────────

  it('resets loadErrors on a fresh getRegistry() call after module state is cleared', async () => {
    // First call: azure fails
    mockRegister.mockImplementation((pack: { name: string }) => {
      if (pack.name === 'azure') throw new Error('azure bad');
    });
    mockSeal.mockReturnValue(undefined);

    const mod1 = await import('./packs.js');
    mod1.getRegistry();
    expect(mod1.getLoadErrors()).toHaveLength(1);

    // Reset module state (simulates process restart / module reload)
    mod1._resetRegistryState();
    mockRegister.mockReturnValue(undefined); // all packs succeed now

    // Second call: all packs succeed
    mod1.getRegistry();
    expect(mod1.getLoadErrors()).toEqual([]);
  });

  // ── Nibbler test 5: registry.seal() failure is a hard stop ───────────────

  it('propagates registry.seal() failure as a hard stop', async () => {
    mockRegister.mockReturnValue(undefined);
    mockSeal.mockImplementation(() => {
      throw new Error('Seal failed: duplicate agent registered');
    });

    const { getRegistry } = await import('./packs.js');
    expect(() => getRegistry()).toThrow('Seal failed: duplicate agent registered');
  });

  // ── Leela C1: core pack failure is always a hard stop ────────────────────

  it('rethrows immediately when the core pack fails (hard stop)', async () => {
    const coreErr = new ZodError([
      {
        code: ZodIssueCode.unrecognized_keys,
        path: [],
        message: 'Unrecognized key(s) in object',
        keys: ['domain', 'confidence', 'source'],
      },
    ]);

    mockRegister.mockImplementation((pack: { name: string }) => {
      if (pack.name === 'core') throw coreErr;
    });

    const { getRegistry, getLoadErrors } = await import('./packs.js');
    expect(() => getRegistry()).toThrow();

    // Registry was never sealed — _registry stays null; loadErrors stays empty
    // (the error was rethrown before it could be quarantined)
    expect(getLoadErrors()).toEqual([]);
  });
});
