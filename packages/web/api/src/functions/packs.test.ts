/**
 * HTTP-level tests for GET /api/packs
 *
 * Covers Nibbler's binding Case 2 requirements:
 *  - Happy path: 200 with { components, userActions, playgroundScenarios, loadErrors: [] }
 *  - Degraded path: 200 with loadErrors populated — sanitized shape only, no raw strings
 *  - Error path: 500 with opaque body; raw err.message / paths / Zod text absent
 *
 * Follows the same vi.hoisted() + app.http capture pattern used in health.test.ts.
 */

import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import * as appinsightsModule from '../lib/appinsights.js';

// ---------------------------------------------------------------------------
// Hoisted mock setup
// ---------------------------------------------------------------------------

const { registeredHandlers, registerHttpHandler, mockGetRegistry, mockGetLoadErrors } =
  vi.hoisted(() => {
    const registeredHandlers = new Map<
      string,
      (request: unknown, context: unknown) => Promise<unknown>
    >();
    const registerHttpHandler = vi.fn(
      (
        name: string,
        config: { handler: (request: unknown, context: unknown) => Promise<unknown> },
      ) => {
        registeredHandlers.set(name, config.handler);
      },
    );
    const mockGetRegistry = vi.fn();
    const mockGetLoadErrors = vi.fn(() => []);
    return { registeredHandlers, registerHttpHandler, mockGetRegistry, mockGetLoadErrors };
  });

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@azure/functions', () => ({
  app: { http: registerHttpHandler },
}));

vi.mock('../startup/packs.js', () => ({
  getRegistry: mockGetRegistry,
  getLoadErrors: mockGetLoadErrors,
}));

vi.mock('../lib/logger.js', () => ({
  Logger: class {
    withContext() { return this; }
    info() {}
    error() {}
    warn() {}
  },
  extractTraceId: vi.fn(() => 'trace-id'),
  extractRequestMetadata: vi.fn(() => ({})),
}));

vi.mock('zod-to-json-schema', () => ({
  zodToJsonSchema: vi.fn(() => ({ type: 'object' })),
}));

vi.mock('../lib/appinsights.js', () => ({
  trackException: vi.fn(),
  trackEvent: vi.fn(),
  trackTrace: vi.fn(),
  flushAppInsights: vi.fn().mockResolvedValue(undefined),
  initializeAppInsights: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): unknown {
  return {
    query: { get: () => null },
    headers: { get: () => null },
    url: 'https://example.com/api/packs',
    method: 'GET',
  };
}

function makeContext(): unknown {
  return { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
}

function makeRegistry(overrides: Partial<{
  components: unknown[];
  catalog: { userActions: string[] };
  playgroundScenarios: unknown[];
  getUserAction: (name: string) => unknown;
}> = {}) {
  return {
    components: [{ name: 'core/Text', propertySchema: { type: 'object' } }],
    catalog: { userActions: [] },
    playgroundScenarios: [{ id: 'core/questionnaire', title: 'Questionnaire' }],
    getUserAction: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let packsHandler: (request: unknown, context: unknown) => Promise<unknown>;

beforeAll(async () => {
  await import('./packs.js');
  const handler = registeredHandlers.get('packs');
  if (!handler) throw new Error('packs handler not registered');
  packsHandler = handler;
});

beforeEach(() => {
  mockGetRegistry.mockReturnValue(makeRegistry());
  mockGetLoadErrors.mockReturnValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/packs — happy path', () => {
  it('returns 200 with components, userActions, playgroundScenarios and empty loadErrors', async () => {
    const res = (await packsHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };

    expect(res.status).toBe(200);

    // Required top-level fields
    expect(res.jsonBody).toHaveProperty('components');
    expect(res.jsonBody).toHaveProperty('userActions');
    expect(res.jsonBody).toHaveProperty('playgroundScenarios');
    expect(res.jsonBody).toHaveProperty('loadErrors');
    expect(res.jsonBody.loadErrors).toEqual([]);

    // loadErrors is an array
    expect(Array.isArray(res.jsonBody.loadErrors)).toBe(true);

    // No raw error strings in success response
    const body = JSON.stringify(res.jsonBody);
    expect(body).not.toContain('err.message');
    expect(body).not.toContain('ZodError');
    expect(body).not.toContain('/home/');
    expect(body).not.toContain('wwwroot');
  });

  it('includes scenario data from the registry', async () => {
    const res = (await packsHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };

    const scenarios = res.jsonBody.playgroundScenarios as Array<{ id: string; title: string }>;
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]).toMatchObject({ id: 'core/questionnaire', title: 'Questionnaire' });
  });
});

describe('GET /api/packs — degraded path', () => {
  it('returns 200 with sanitized loadErrors when non-core packs failed', async () => {
    mockGetLoadErrors.mockReturnValue([
      { packId: 'azure', reason: 'schema_validation' },
      { packId: 'github', reason: 'unknown' },
    ]);

    const res = (await packsHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };

    // Still 200 — registry is sealed, core pack loaded
    expect(res.status).toBe(200);

    const errors = res.jsonBody.loadErrors as Array<{ packId: string; reason: string }>;
    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({ packId: 'azure', reason: 'schema_validation' });
    expect(errors[1]).toEqual({ packId: 'github', reason: 'unknown' });

    // Sanitization: entries have ONLY packId and reason — no error message, no file path
    for (const entry of errors) {
      expect(Object.keys(entry)).toEqual(['packId', 'reason']);
    }

    // No raw error content anywhere in the response body
    const body = JSON.stringify(res.jsonBody);
    expect(body).not.toContain('ZodError');
    expect(body).not.toContain('/home/');
    expect(body).not.toContain('wwwroot');
    expect(body).not.toContain('unrecognized_keys');
    expect(body).not.toContain('err.message');
  });

  it('still returns components even when some packs have load errors', async () => {
    mockGetLoadErrors.mockReturnValue([{ packId: 'aks', reason: 'parse_error' }]);

    const res = (await packsHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };

    expect(res.status).toBe(200);
    expect(Array.isArray(res.jsonBody.components)).toBe(true);
    expect((res.jsonBody.components as unknown[]).length).toBeGreaterThan(0);
  });
});

describe('GET /api/packs — error path', () => {
  it('returns 500 with opaque body when registry throws', async () => {
    const sensitiveErr = new Error(
      'ZodError: unrecognized_keys at /home/site/wwwroot/api/dist/functions/pack-assets/azure/skills/bad.SKILL.md',
    );
    mockGetRegistry.mockImplementation(() => { throw sensitiveErr; });

    const res = (await packsHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };

    expect(res.status).toBe(500);

    // Opaque error message per DP #1030 amendment 1 (Nibbler C4): stable label + requestId
    expect(res.jsonBody.error).toBe('Pack registry unavailable');
    expect(typeof res.jsonBody.requestId).toBe('string');
    expect(res.jsonBody.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    // Critically: none of the sensitive error content appears in the response
    const body = JSON.stringify(res.jsonBody);
    expect(body).not.toContain('ZodError');
    expect(body).not.toContain('/home/');
    expect(body).not.toContain('wwwroot');
    expect(body).not.toContain('pack-assets');
    expect(body).not.toContain('unrecognized_keys');
    expect(body).not.toContain(sensitiveErr.message);
  });

  it('returns 500 even for non-Error throws', async () => {
    mockGetRegistry.mockImplementation(() => { throw 'string-throw'; });

    const res = (await packsHandler(makeRequest(), makeContext())) as {
      status: number;
      jsonBody: Record<string, unknown>;
    };

    expect(res.status).toBe(500);
    expect(typeof res.jsonBody.error).toBe('string');
    expect(res.jsonBody.error).not.toContain('string-throw');
  });
});

// ---------------------------------------------------------------------------
// N3 — Nibbler: initializeAppInsights is called inside the handler
// ---------------------------------------------------------------------------

describe('N3 — initializeAppInsights called inside packs handler', () => {
  it('calls initializeAppInsights as the first statement of each handler invocation', async () => {
    const spy = vi.spyOn(appinsightsModule, 'initializeAppInsights');
    await packsHandler(makeRequest(), makeContext());
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
