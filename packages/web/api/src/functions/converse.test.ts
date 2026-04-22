/**
 * HTTP-level tests for POST /api/converse
 *
 * Covers Nibbler N3: initializeAppInsights must be called inside the
 * handler function body (not at module load).
 *
 * Follows the same vi.hoisted() + app.http capture pattern used in
 * health.test.ts and packs.test.ts.
 */

import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import * as appinsightsModule from '../lib/appinsights.js';

// ---------------------------------------------------------------------------
// Hoisted mock setup
// ---------------------------------------------------------------------------

const { registeredHandlers, registerHttpHandler } = vi.hoisted(() => {
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
  return { registeredHandlers, registerHttpHandler };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@azure/functions', () => ({
  app: { http: registerHttpHandler },
}));

vi.mock('../startup/packs.js', () => ({
  getRegistry: vi.fn(() => ({
    components: [],
    catalog: { userActions: [] },
    playgroundScenarios: [],
    getUserAction: vi.fn(),
  })),
  getLoadErrors: vi.fn(() => []),
}));

vi.mock('../lib/logger.js', () => ({
  Logger: class {
    withContext() { return this; }
    info() {}
    error() {}
    warn() {}
    debug() {}
  },
  extractTraceId: vi.fn(() => 'trace-id'),
  extractRequestMetadata: vi.fn(() => ({})),
}));

vi.mock('../lib/appinsights.js', () => ({
  trackException: vi.fn(),
  trackEvent: vi.fn(),
  trackTrace: vi.fn(),
  flushAppInsights: vi.fn().mockResolvedValue(undefined),
  initializeAppInsights: vi.fn(),
}));

vi.mock('../telemetry/sanitize-error.js', () => ({
  sanitizeError: vi.fn((err: unknown) =>
    err instanceof Error ? err : new Error(String(err)),
  ),
}));

vi.mock('@aks-kickstart/harness/runtime/session', () => ({
  getOrCreateSession: vi.fn(() => ({ sessionId: 'test-session', oid: 'anonymous' })),
}));

vi.mock('@aks-kickstart/harness/runtime/runner', () => ({
  Runner: class {
    run = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('@aks-kickstart/harness/runtime/sse', () => ({
  SSE_RESPONSE_HEADERS: { 'Content-Type': 'text/event-stream' },
  formatSSEFrame: vi.fn((event: string, data: unknown) =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown> = { message: 'hello' }): unknown {
  return {
    headers: { get: () => null },
    url: 'https://example.com/api/converse',
    method: 'POST',
    json: vi.fn().mockResolvedValue(body),
  };
}

function makeContext(): unknown {
  return { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let converseHandler: (request: unknown, context: unknown) => Promise<unknown>;

beforeAll(async () => {
  await import('./converse.js');
  const handler = registeredHandlers.get('converse');
  if (!handler) throw new Error('converse handler not registered');
  converseHandler = handler;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// N3 — Nibbler: initializeAppInsights is called inside the handler
// ---------------------------------------------------------------------------

describe('N3 — initializeAppInsights called inside converse handler', () => {
  it('calls initializeAppInsights as the first statement of each handler invocation', async () => {
    const spy = vi.spyOn(appinsightsModule, 'initializeAppInsights');
    await converseHandler(makeRequest(), makeContext());
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
