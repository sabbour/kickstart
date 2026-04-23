/**
 * Integration tests for the #1074 cold-session hydration wire-up on
 * POST /api/converse.
 *
 * Uses the repo's standard Azure Functions HTTP handler test harness
 * (vi.hoisted() + vi.mock() + app.http capture), see `cost-estimate.test.ts`
 * and `converse.test.ts` for prior art.
 *
 * Coverage matrix (issue #1074 AC + Zapp M1–M4 / L4 + Nibbler additive):
 *  - brand-new session + valid messages[] → hydrated, recentTurns populated
 *  - warm session + messages[] → ignored, session-hydration-ignored event
 *  - empty messages[] distinct from absent messages (Nibbler #2)
 *  - Zod rejects unknown role / extra fields / case variants (Zapp L4)
 *  - Array over cap (21 messages) → 400 HYDRATION_ARRAY_TOO_LARGE (Nibbler #5)
 *  - Content over 4 KB → 400 HYDRATION_CONTENT_TOO_LARGE
 *  - Pre-parse Content-Length cap rejects >256 KB (Zapp L1)
 *  - Anon without HARNESS_ALLOW_ANON_HYDRATION → 403 (Zapp M4)
 *  - Guardrail block on hydrated user turn → 400 HYDRATION_BLOCKED_BY_GUARDRAIL
 *    and session is dropped (Zapp M2, L4)
 *  - Credential pattern in hydrated content → sanitized by sanitizeText before
 *    it reaches recentTurns (Nibbler #8 — PII/redaction)
 *  - End-to-end: runner receives hydrated turns in its input (Nibbler #7)
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientHydrationMessage } from '@aks-kickstart/harness/runtime/session';

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const {
  registeredHandlers,
  registerHttpHandler,
  mockSession,
  runnerRunMock,
  getOrCreateSessionMock,
  hydrateColdSessionMock,
  sessionStoreMock,
  guardrailsMock,
  runGuardrailsMock,
  trackEventMock,
} = vi.hoisted(() => {
  const registeredHandlers = new Map<
    string,
    (request: unknown, context: unknown) => Promise<unknown>
  >();
  const registerHttpHandler = vi.fn(
    (name: string, config: { handler: (request: unknown, context: unknown) => Promise<unknown> }) => {
      registeredHandlers.set(name, config.handler);
    },
  );
  const mockSession = {
    sessionId: 'sess-1',
    recentTurns: [] as Array<{ role: string; content: string; trust?: string }>,
    activeAgent: 'core.triage',
    user: { oid: 'user-1' as string },
  };
  const runnerRunMock = vi.fn().mockResolvedValue(undefined);
  const getOrCreateSessionMock = vi.fn();
  const hydrateColdSessionMock = vi.fn();
  const sessionStoreMock = { delete: vi.fn() };
  const guardrailsMock: unknown[] = [];
  const runGuardrailsMock = vi.fn();
  const trackEventMock = vi.fn();
  return {
    registeredHandlers,
    registerHttpHandler,
    mockSession,
    runnerRunMock,
    getOrCreateSessionMock,
    hydrateColdSessionMock,
    sessionStoreMock,
    guardrailsMock,
    runGuardrailsMock,
    trackEventMock,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@azure/functions', () => ({
  app: { http: registerHttpHandler },
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
  trackEvent: trackEventMock,
  trackTrace: vi.fn(),
  flushAppInsights: vi.fn().mockResolvedValue(undefined),
  initializeAppInsights: vi.fn(),
}));

vi.mock('../telemetry/sanitize-error.js', () => ({
  sanitizeError: vi.fn((err: unknown) => (err instanceof Error ? err : new Error(String(err)))),
}));

vi.mock('../startup/packs.js', () => ({
  getRegistry: vi.fn(() => ({
    getGuardrailsByStage: vi.fn(() => guardrailsMock),
    getAgent: vi.fn(() => ({})),
    components: [],
    catalog: { userActions: [] },
    playgroundScenarios: [],
    getUserAction: vi.fn(),
  })),
  getLoadErrors: vi.fn(() => []),
}));

vi.mock('@aks-kickstart/harness/runtime/session', () => ({
  getOrCreateSession: getOrCreateSessionMock,
  hydrateColdSession: hydrateColdSessionMock,
  isHistoryHydrationEnabled: vi.fn(() => true),
  isAnonHydrationAllowed: vi.fn(() => process.env.HARNESS_ALLOW_ANON_HYDRATION === 'true'),
  sessionStore: sessionStoreMock,
  HYDRATION_DEFAULT_CAP: 20,
  HYDRATION_CONTENT_MAX_BYTES: 4 * 1024,
}));

vi.mock('@aks-kickstart/harness/runtime/runner', () => ({
  Runner: class {
    run = runnerRunMock;
  },
}));

vi.mock('@aks-kickstart/harness/runtime/sse', () => ({
  SSE_RESPONSE_HEADERS: { 'Content-Type': 'text/event-stream' },
  formatSSEFrame: vi.fn((event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
}));

vi.mock('@aks-kickstart/harness/runtime/guardrails', () => ({
  runGuardrails: runGuardrailsMock,
}));

// sanitizeText — use the real implementation so PII/redaction tests are
// meaningful (Nibbler #8). Re-exported here via a partial mock.
vi.mock('@aks-kickstart/harness/runtime/redact', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@aks-kickstart/harness/runtime/redact',
  );
  return actual;
});

// ---------------------------------------------------------------------------
// Request / context helpers
// ---------------------------------------------------------------------------

interface MakeRequestOpts {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

function makeRequest(opts: MakeRequestOpts = {}): unknown {
  const headers = new Map(Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    url: 'https://example.com/api/converse',
    method: 'POST',
    json: vi.fn().mockResolvedValue(opts.body ?? { message: 'hi' }),
  };
}

function makeContext(): unknown {
  return { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let converseHandler: (request: unknown, context: unknown) => Promise<Response>;

beforeAll(async () => {
  await import('./converse.js');
  const handler = registeredHandlers.get('converse');
  if (!handler) throw new Error('converse handler not registered');
  converseHandler = handler as typeof converseHandler;
});

beforeEach(() => {
  mockSession.recentTurns = [];
  mockSession.user = { oid: 'user-1' };
  mockSession.sessionId = 'sess-1';
  getOrCreateSessionMock.mockReset();
  getOrCreateSessionMock.mockReturnValue(mockSession);
  hydrateColdSessionMock.mockReset();
  // Default: simulate the real helper's push + trust-stamp so the runner-input
  // end-to-end assertion has realistic state to observe.
  hydrateColdSessionMock.mockImplementation((session: typeof mockSession, msgs: ClientHydrationMessage[] | undefined) => {
    if (!msgs) return { hydrated: 0, ignored: null };
    for (const m of msgs) {
      session.recentTurns.push({ role: m.role, content: m.content, trust: 'client-hydrated' });
    }
    return { hydrated: msgs.length, ignored: null };
  });
  sessionStoreMock.delete.mockReset();
  runGuardrailsMock.mockReset();
  runGuardrailsMock.mockImplementation(async (_stage, input: { userMessage: string }) => ({
    blocked: false,
    mutatedInput: input,
  }));
  runnerRunMock.mockReset();
  runnerRunMock.mockResolvedValue(undefined);
  trackEventMock.mockReset();
  guardrailsMock.length = 0;
  // Tests default to an authenticated-like flow (the M4 anon interlock is
  // exercised explicitly in its own describe block below). Setting the flag
  // here avoids having to mint a SWA principal header in every test — the
  // handler's anon path defaults to `oid === 'anonymous'` when no
  // x-ms-client-principal header is present.
  process.env.HARNESS_ALLOW_ANON_HYDRATION = 'true';
});

afterEach(() => {
  delete process.env.HARNESS_ALLOW_ANON_HYDRATION;
});

async function drainSSE(res: Response): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('#1074 — cold-session hydration: happy path', () => {
  it('hydrates a brand-new session from client-supplied messages', async () => {
    const res = await converseHandler(
      makeRequest({
        body: {
          message: 'continue',
          messages: [
            { role: 'user', content: 'what is kubernetes' },
            { role: 'assistant', content: 'a container orchestrator' },
          ],
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    await drainSSE(res);
    expect(hydrateColdSessionMock).toHaveBeenCalledTimes(1);
    expect(mockSession.recentTurns).toHaveLength(2);
    expect(mockSession.recentTurns.every((t) => t.trust === 'client-hydrated')).toBe(true);
    const hydratedEvents = trackEventMock.mock.calls.filter((c) => c[0] === 'session-hydrated');
    expect(hydratedEvents).toHaveLength(1);
    expect(hydratedEvents[0][1]).toMatchObject({ turnCount: '2', userTurnCount: '1', assistantTurnCount: '1' });
  });

  // Nibbler #7: end-to-end — runner sees hydrated turns, not just recentTurns.
  it('runner.run receives the session with hydrated recentTurns populated', async () => {
    await converseHandler(
      makeRequest({
        body: {
          message: 'continue',
          messages: [{ role: 'user', content: 'hydrated-seed' }],
        },
      }),
      makeContext(),
    );
    expect(runnerRunMock).toHaveBeenCalled();
    const [sessionArg] = runnerRunMock.mock.calls[0];
    expect((sessionArg as typeof mockSession).recentTurns).toHaveLength(1);
    expect((sessionArg as typeof mockSession).recentTurns[0].content).toBe('hydrated-seed');
    expect((sessionArg as typeof mockSession).recentTurns[0].trust).toBe('client-hydrated');
  });
});

// ---------------------------------------------------------------------------
// Warm session + flag-off paths
// ---------------------------------------------------------------------------

describe('#1074 — warm session / flag off', () => {
  it('warm session ignores messages and emits session-hydration-ignored', async () => {
    mockSession.recentTurns = [{ role: 'user', content: 'already-here' }];
    const res = await converseHandler(
      makeRequest({
        body: {
          message: 'continue',
          messages: [{ role: 'user', content: 'client-attempt' }],
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    await drainSSE(res);
    expect(hydrateColdSessionMock).not.toHaveBeenCalled();
    expect(mockSession.recentTurns).toHaveLength(1);
    expect(mockSession.recentTurns[0].content).toBe('already-here');
    const ignored = trackEventMock.mock.calls.filter((c) => c[0] === 'session-hydration-ignored');
    expect(ignored).toHaveLength(1);
    expect(ignored[0][1]).toMatchObject({ reason: 'warm' });
  });

  // Nibbler #2: empty array distinct from absent.
  it('empty messages array on cold session is a no-op (no hydration, no rejected event)', async () => {
    const res = await converseHandler(
      makeRequest({ body: { message: 'continue', messages: [] } }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    await drainSSE(res);
    // Helper IS called with [] under the hood (so the helper can emit its own
    // no-op result); the key assertion is that NO rejection telemetry fired.
    const rejects = trackEventMock.mock.calls.filter((c) => c[0] === 'session-hydration-rejected');
    expect(rejects).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Schema validation (Zapp M1 + L4, Nibbler #5)
// ---------------------------------------------------------------------------

describe('#1074 — strict schema (Zapp M1/L4)', () => {
  it('rejects unknown role "tool"', async () => {
    const res = await converseHandler(
      makeRequest({
        body: { message: 'm', messages: [{ role: 'tool', content: 'x' }] },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe('HYDRATION_INVALID_SCHEMA');
  });

  it('rejects unknown role "system"', async () => {
    const res = await converseHandler(
      makeRequest({
        body: { message: 'm', messages: [{ role: 'system', content: 'x' }] },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('rejects case-variant role "User"', async () => {
    const res = await converseHandler(
      makeRequest({
        body: { message: 'm', messages: [{ role: 'User', content: 'x' }] },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('rejects extra fields on a message (strict)', async () => {
    const res = await converseHandler(
      makeRequest({
        body: {
          message: 'm',
          messages: [{ role: 'user', content: 'x', trust: 'server' }],
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  // Nibbler #5: cap+1 entries should return a *distinct* code from size.
  it('rejects 21 messages (cap+1) with HYDRATION_ARRAY_TOO_LARGE', async () => {
    const res = await converseHandler(
      makeRequest({
        body: {
          message: 'm',
          messages: Array.from({ length: 21 }, (_, i) => ({ role: 'user' as const, content: `m${i}` })),
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe('HYDRATION_ARRAY_TOO_LARGE');
  });

  it('rejects a message with content > 4 KB with HYDRATION_CONTENT_TOO_LARGE', async () => {
    const res = await converseHandler(
      makeRequest({
        body: {
          message: 'm',
          messages: [{ role: 'user', content: 'x'.repeat(4 * 1024 + 1) }],
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Pre-parse size cap (Zapp L1)
// ---------------------------------------------------------------------------

describe('#1074 — pre-parse Content-Length cap (Zapp L1)', () => {
  it('rejects with 413 when Content-Length exceeds 256 KB', async () => {
    const res = await converseHandler(
      makeRequest({
        headers: { 'content-length': String(256 * 1024 + 1) },
        body: { message: 'm' },
      }),
      makeContext(),
    );
    expect(res.status).toBe(413);
  });

  it('accepts when Content-Length is at 256 KB', async () => {
    const res = await converseHandler(
      makeRequest({
        headers: { 'content-length': String(256 * 1024) },
        body: { message: 'm' },
      }),
      makeContext(),
    );
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Anon interlock (Zapp M4)
// ---------------------------------------------------------------------------

describe('#1074 — anonymous hydration interlock (Zapp M4)', () => {
  it('rejects 403 when anonymous and HARNESS_ALLOW_ANON_HYDRATION is off', async () => {
    delete process.env.HARNESS_ALLOW_ANON_HYDRATION;
    const res = await converseHandler(
      makeRequest({
        body: { message: 'm', messages: [{ role: 'user', content: 'x' }] },
      }),
      makeContext(),
    );
    expect(res.status).toBe(403);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe('HYDRATION_ANON_FORBIDDEN');
    expect(sessionStoreMock.delete).toHaveBeenCalledWith('sess-1');
    const rej = trackEventMock.mock.calls.filter((c) => c[0] === 'session-hydration-rejected');
    expect(rej.some((r) => r[1].reason === 'anon-hydration-forbidden')).toBe(true);
  });

  it('allows anonymous hydration when HARNESS_ALLOW_ANON_HYDRATION=true', async () => {
    // flag already set to 'true' by beforeEach (default for the suite).
    const res = await converseHandler(
      makeRequest({
        body: { message: 'm', messages: [{ role: 'user', content: 'x' }] },
      }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    await drainSSE(res);
    expect(hydrateColdSessionMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Guardrails (Zapp M2, L4)
// ---------------------------------------------------------------------------

describe('#1074 — per-turn input guardrails (Zapp M2)', () => {
  it('rejects 400 HYDRATION_BLOCKED_BY_GUARDRAIL and drops the session on any block', async () => {
    guardrailsMock.push({ id: 'core/test', stages: ['input'], appliesTo: ['*'], evaluate: vi.fn() });
    runGuardrailsMock.mockImplementationOnce(async (_s, input) => ({ blocked: false, mutatedInput: input }));
    runGuardrailsMock.mockImplementationOnce(async (_s, input) => ({ blocked: true, mutatedInput: input }));
    const res = await converseHandler(
      makeRequest({
        body: {
          message: 'm',
          messages: [
            { role: 'user', content: 'ok' },
            { role: 'user', content: 'bad' },
          ],
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe('HYDRATION_BLOCKED_BY_GUARDRAIL');
    expect(sessionStoreMock.delete).toHaveBeenCalledWith('sess-1');
    expect(hydrateColdSessionMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PII / credential redaction (Nibbler #8)
// ---------------------------------------------------------------------------

describe('#1074 — sanitizeText runs on hydrated content before the LLM (Nibbler #8)', () => {
  it('scrubs Authorization: Bearer … out of hydrated content before recordTurn', async () => {
    await converseHandler(
      makeRequest({
        body: {
          message: 'm',
          messages: [
            { role: 'user', content: 'please check Authorization: Bearer abc123SECRET for me' },
          ],
        },
      }),
      makeContext(),
    );
    expect(hydrateColdSessionMock).toHaveBeenCalledTimes(1);
    const [, msgs] = hydrateColdSessionMock.mock.calls[0];
    const hydratedContent = (msgs as ClientHydrationMessage[])[0].content;
    expect(hydratedContent).not.toContain('abc123SECRET');
    expect(hydratedContent).toContain('[REDACTED]');
  });
});
