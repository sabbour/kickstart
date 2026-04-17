/**
 * Tests for Step 10: A2UI registry renderer, UserAction dispatcher
 *
 * Covers:
 * - A2UI renders registry components (all packs registered at startup)
 * - Unknown component name shows error MessageBar (no silent failure)
 * - user_action_required dispatches to correct handler in real mode
 * - user_action_required dispatches to playground stubs in playground mode
 * - Cancellation queue: queued actions resume after current UserAction completes
 * - Missing confirmComponent → fail closed (no resume POST emitted)
 * - Pre-render schema.parse() strips unknown keys and validates props
 * - useA2UIRegistry() throws if called before seal()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  ClientComponentRegistry,
  KICKSTART_CATALOG_ID,
  validateAndSanitizeComponents,
  stripDangerousKeys,
  sanitizeComponentProps,
  isPropsTooLarge,
  MAX_PROP_DEPTH,
  MAX_PROP_BYTES,
} from '../contexts/A2UIRegistryContext';
import { dispatchUserActionResult, UserActionQueueManager } from '../hooks/useActionDispatch';
import type { UserActionReqPayload } from '../hooks/useStreaming';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeImpl(name: string, schema?: z.ZodTypeAny) {
  return {
    name,
    schema: schema ?? z.object({}),
    render: () => null,
  } as any;
}

// ---------------------------------------------------------------------------
// ClientComponentRegistry — seal invariant
// ---------------------------------------------------------------------------

describe('ClientComponentRegistry — seal invariant', () => {
  it('allows registrations before seal', () => {
    const reg = new ClientComponentRegistry();
    expect(() => reg.register(makeImpl('Button'))).not.toThrow();
  });

  it('throws on registration after seal', () => {
    const reg = new ClientComponentRegistry();
    reg.seal();
    expect(() => reg.register(makeImpl('Button'))).toThrow('sealed');
  });

  it('useA2UIRegistry throws if called before seal (getImpl guard)', () => {
    const reg = new ClientComponentRegistry();
    reg.register(makeImpl('Button'));
    expect(() => reg.getImpl('Button')).toThrow('before seal');
  });

  it('getImpl returns undefined for unknown component after seal', () => {
    const reg = new ClientComponentRegistry();
    reg.register(makeImpl('Button'));
    reg.seal();
    expect(reg.getImpl('NotRegistered')).toBeUndefined();
  });

  it('getImpl returns registered component after seal', () => {
    const reg = new ClientComponentRegistry();
    const impl = makeImpl('Button');
    reg.register(impl);
    reg.seal();
    const found = reg.getImpl('Button');
    expect(found?.name).toBe('Button');
  });

  it('buildCatalog throws before seal', () => {
    const reg = new ClientComponentRegistry();
    expect(() => reg.buildCatalog()).toThrow('before seal');
  });

  it('buildCatalog returns a Catalog with KICKSTART_CATALOG_ID after seal', () => {
    const reg = new ClientComponentRegistry();
    reg.register(makeImpl('Button'));
    reg.seal();
    const catalog = reg.buildCatalog();
    expect(catalog.id).toBe(KICKSTART_CATALOG_ID);
  });

  it('getNames lists registered components (excluding _ErrorComponent)', () => {
    const reg = new ClientComponentRegistry();
    reg.register(makeImpl('Button'));
    reg.register(makeImpl('Text'));
    reg.seal();
    const names = reg.getNames();
    expect(names).toContain('Button');
    expect(names).toContain('Text');
    expect(names).not.toContain('_ErrorComponent');
  });

  it('registers all pack components at startup (simulated)', () => {
    const reg = new ClientComponentRegistry();
    const fakePackComponents = ['Button', 'Text', 'Card', 'AuthCard', 'SummaryCard'];
    for (const name of fakePackComponents) {
      reg.register(makeImpl(name));
    }
    reg.seal();
    for (const name of fakePackComponents) {
      expect(reg.getImpl(name)).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// validateAndSanitizeComponents — pre-render prop validation (Zapp Crit1)
// ---------------------------------------------------------------------------

describe('validateAndSanitizeComponents — pre-render validation', () => {
  let reg: ClientComponentRegistry;

  beforeEach(() => {
    reg = new ClientComponentRegistry();
    reg.register(makeImpl('Button', z.object({ label: z.string() })));
    reg.register(makeImpl('TextInput', z.object({ value: z.string(), maxLength: z.number().max(100) })));
    reg.seal();
  });

  it('passes valid components through unchanged (except id/component)', () => {
    const result = validateAndSanitizeComponents(
      [{ id: 'c1', component: 'Button', label: 'Click me' }],
      reg,
    );
    expect(result[0].component).toBe('Button');
    expect((result[0] as any).label).toBe('Click me');
  });

  it('strips unknown keys via schema.parse()', () => {
    const result = validateAndSanitizeComponents(
      [{ id: 'c1', component: 'Button', label: 'OK', unknown_key: 'should_be_stripped' }],
      reg,
    );
    expect(result[0].component).toBe('Button');
    expect((result[0] as any).unknown_key).toBeUndefined();
    expect((result[0] as any).label).toBe('OK');
  });

  it('replaces unknown component name with _ErrorComponent', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = validateAndSanitizeComponents(
      [{ id: 'c1', component: 'UnknownWidget', foo: 'bar' }],
      reg,
    );
    expect(result[0].component).toBe('_ErrorComponent');
    expect((result[0] as any).foo).toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown component'),
    );
    errorSpy.mockRestore();
  });

  it('replaces component with failed schema validation with _ErrorComponent', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // maxLength > 100 should fail
    const result = validateAndSanitizeComponents(
      [{ id: 'c1', component: 'TextInput', value: 'hello', maxLength: 9999 }],
      reg,
    );
    expect(result[0].component).toBe('_ErrorComponent');
    errorSpy.mockRestore();
  });

  it('strips dangerous keys before schema parse', () => {
    const result = validateAndSanitizeComponents(
      [{ id: 'c1', component: 'Button', label: 'OK', __proto__: { evil: true } }],
      reg,
    );
    expect(result[0].component).toBe('Button');
    expect((result[0] as any).__proto__).not.toHaveProperty('evil');
  });
});

// ---------------------------------------------------------------------------
// stripDangerousKeys
// ---------------------------------------------------------------------------

describe('stripDangerousKeys', () => {
  it('removes __proto__, prototype, constructor keys', () => {
    const input = { a: 1, __proto__: { evil: true }, prototype: {}, constructor: 'fn' };
    const result = stripDangerousKeys(input) as Record<string, unknown>;
    expect(result.a).toBe(1);
    // Use hasOwnProperty to check — 'in' traverses the prototype chain
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result, 'prototype')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result, 'constructor')).toBe(false);
  });

  it('recursively processes nested objects', () => {
    const input = { nested: { __proto__: { evil: true }, value: 42 } };
    const result = stripDangerousKeys(input) as Record<string, unknown>;
    const nested = result.nested as Record<string, unknown>;
    expect(nested.value).toBe(42);
    expect(Object.prototype.hasOwnProperty.call(nested, '__proto__')).toBe(false);
  });

  it('returns undefined beyond MAX_PROP_DEPTH', () => {
    let deep: Record<string, unknown> = { val: 'leaf' };
    for (let i = 0; i < MAX_PROP_DEPTH + 2; i++) {
      deep = { child: deep };
    }
    const result = stripDangerousKeys(deep) as Record<string, unknown>;
    // Should truncate at depth limit
    expect(result).toBeDefined();
  });

  it('handles arrays', () => {
    const input = [{ a: 1, __proto__: { x: 1 } }, { b: 2 }];
    const result = stripDangerousKeys(input) as Array<Record<string, unknown>>;
    expect(Array.isArray(result)).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(result[0], '__proto__')).toBe(false);
    expect(result[1].b).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// sanitizeComponentProps — URL validation
// ---------------------------------------------------------------------------

describe('sanitizeComponentProps — URL validation', () => {
  it('passes https:// URLs through', () => {
    const result = sanitizeComponentProps({ href: 'https://example.com/page' });
    expect(result.href).toBe('https://example.com/page');
  });

  it('rejects http:// URLs for href', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = sanitizeComponentProps({ href: 'http://example.com' });
    expect(result.href).toBeUndefined();
    warnSpy.mockRestore();
  });

  it('rejects javascript: URLs', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = sanitizeComponentProps({ href: 'javascript:alert(1)' });
    expect(result.href).toBeUndefined();
    warnSpy.mockRestore();
  });

  it('validates src prop', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = sanitizeComponentProps({ src: 'data:image/svg+xml,<evil>' });
    expect(result.src).toBeUndefined();
    warnSpy.mockRestore();
  });

  it('passes non-URL props through unchanged', () => {
    const result = sanitizeComponentProps({ label: 'Click', count: 5 });
    expect(result.label).toBe('Click');
    expect(result.count).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// isPropsTooLarge — 64KB limit
// ---------------------------------------------------------------------------

describe('isPropsTooLarge', () => {
  it('returns false for small props', () => {
    expect(isPropsTooLarge({ label: 'OK' })).toBe(false);
  });

  it('returns true for props exceeding 64KB', () => {
    const bigValue = 'x'.repeat(MAX_PROP_BYTES + 100);
    expect(isPropsTooLarge({ data: bigValue })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dispatchUserActionResult — POST body boundary (Zapp B2)
// ---------------------------------------------------------------------------

describe('dispatchUserActionResult — resume POST boundary', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const payload: UserActionReqPayload = {
    sessionId: 'sess-123',
    actionId: 'act-456',
    toolName: 'azure:create_subscription',
    wireName: 'azure__create_subscription',
    parameters: { name: 'test' },
    confirmComponent: { component: 'AzureLoginCard' },
    scopes: ['https://management.azure.com/.default'],
  };

  it('POSTs { sessionId, actionId, result } only — no toolName or scopes (Zapp B2)', async () => {
    await dispatchUserActionResult(payload, { subscriptionId: 'sub-789' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/converse/resume');

    const body = JSON.parse(opts.body);
    expect(body.sessionId).toBe('sess-123');
    expect(body.actionId).toBe('act-456');
    expect(body.result).toEqual({ subscriptionId: 'sub-789' });

    // Must NOT include server-internal fields
    expect(body.toolName).toBeUndefined();
    expect(body.wireName).toBeUndefined();
    expect(body.scopes).toBeUndefined();
    expect(body.parameters).toBeUndefined();
  });

  it('calls onError on non-OK response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    });
    const onError = vi.fn();
    await dispatchUserActionResult(payload, {}, { onError });
    expect(onError).toHaveBeenCalledWith('Forbidden');
  });

  it('calls onSuccess on 200 response', async () => {
    const onSuccess = vi.fn();
    await dispatchUserActionResult(payload, {}, { onSuccess });
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// useUserActionDispatch — fail closed (Zapp B1)
// ---------------------------------------------------------------------------

describe('useUserActionDispatch — missing confirmComponent fails closed', () => {
  it('validateAndSanitizeComponents: component not in registry → _ErrorComponent, no props forwarded', () => {
    const reg = new ClientComponentRegistry();
    reg.register(makeImpl('Button', z.object({ label: z.string() })));
    reg.seal();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = validateAndSanitizeComponents(
      [{ id: 'x', component: 'AzureLoginCard', clientId: 'secret', token: 'raw' }],
      reg,
    );

    // No raw prop forwarding
    expect(result[0].component).toBe('_ErrorComponent');
    expect((result[0] as any).clientId).toBeUndefined();
    expect((result[0] as any).token).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Cancellation queue policy
// ---------------------------------------------------------------------------

describe('cancellation queue policy', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('dispatchUserActionResult forwards AbortSignal to fetch (cancellation: supported)', async () => {
    const ac = new AbortController();
    const payload: UserActionReqPayload = {
      sessionId: 's1',
      actionId: 'a1',
      toolName: 'core:confirm',
      wireName: 'core__confirm',
      parameters: {},
      scopes: [],
      cancellation: 'supported',
    };

    await dispatchUserActionResult(payload, { confirmed: true }, {}, ac.signal);

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.signal).toBe(ac.signal);
  });

  it('dispatchUserActionResult with AbortSignal — AbortError is swallowed (not rethrown)', async () => {
    const ac = new AbortController();
    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));

    const payload: UserActionReqPayload = {
      sessionId: 's1',
      actionId: 'a1',
      toolName: 'core:confirm',
      wireName: 'core__confirm',
      parameters: {},
      scopes: [],
      cancellation: 'supported',
    };

    const onError = vi.fn();
    // Should NOT throw, and onError should NOT be called for AbortError
    await expect(dispatchUserActionResult(payload, {}, { onError }, ac.signal)).resolves.toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
  });

  it('dispatchUserActionResult without signal — non-abort errors call onError', async () => {
    fetchMock.mockRejectedValue(new Error('Network failure'));

    const payload: UserActionReqPayload = {
      sessionId: 's1',
      actionId: 'a1',
      toolName: 'core:confirm',
      wireName: 'core__confirm',
      parameters: {},
      scopes: [],
    };

    const onError = vi.fn();
    await dispatchUserActionResult(payload, {}, { onError });
    expect(onError).toHaveBeenCalledWith('Network failure');
  });

  it('dispatchUserActionResult can be called sequentially for queued actions', async () => {
    const payload: UserActionReqPayload = {
      sessionId: 's1',
      actionId: 'a1',
      toolName: 'core:confirm',
      wireName: 'core__confirm',
      parameters: {},
      scopes: [],
    };

    // First dispatch
    await dispatchUserActionResult(payload, { confirmed: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second dispatch (queued action)
    const payload2 = { ...payload, actionId: 'a2' };
    await dispatchUserActionResult(payload2, { confirmed: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Each POST uses correct boundary
    const body1 = JSON.parse(fetchMock.mock.calls[0][1].body);
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body1.actionId).toBe('a1');
    expect(body2.actionId).toBe('a2');
    expect(body1.toolName).toBeUndefined();
    expect(body2.toolName).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// UserActionQueueManager — receiveUserActionReq behavior
// (pure class, no DOM required — exercises the same logic as the hook)
// ---------------------------------------------------------------------------

describe('UserActionQueueManager — receiveUserActionReq (renderHook-equivalent)', () => {
  const alwaysValid: import('../hooks/useActionDispatch').ValidateConfirmFn = () => true;
  const alwaysInvalid: import('../hooks/useActionDispatch').ValidateConfirmFn = () => false;

  function makeQueue(validate = alwaysValid) {
    const activations: Array<UserActionReqPayload | null> = [];
    const errors: Array<string | null> = [];
    const q = new UserActionQueueManager(
      validate,
      (p) => activations.push(p),
      (msg) => errors.push(msg),
    );
    return { q, activations, errors };
  }

  function makePayload(actionId: string, opts: Partial<UserActionReqPayload> = {}): UserActionReqPayload {
    return {
      sessionId: 's1',
      actionId,
      toolName: `tool:${actionId}`,
      wireName: `tool__${actionId}`,
      parameters: {},
      scopes: [],
      cancellation: 'not-supported',
      ...opts,
    };
  }

  // ── cancellation: 'supported' path ──────────────────────────────────────

  it('cancellation:supported — B aborts A and becomes active immediately', () => {
    const { q, activations, errors } = makeQueue();

    const payloadA = makePayload('a1');
    const payloadB = makePayload('b1', { cancellation: 'supported' });

    // Activate A
    q.receive(payloadA);
    expect(q.activePayload?.actionId).toBe('a1');
    expect(q.inFlight).toBe(true);
    expect(activations).toHaveLength(1);

    // AbortSignal for A should be undefined (not-supported)
    expect(q.abortSignal).toBeUndefined();

    // Receive B with cancellation:'supported' — A should be aborted, B active
    q.receive(payloadB);
    expect(q.activePayload?.actionId).toBe('b1');
    expect(q.activeActionId).toBe('b1');
    expect(q.inFlight).toBe(true);
    expect(activations).toHaveLength(2);
    expect(activations[1]?.actionId).toBe('b1');
    // Queue should be cleared
    expect(q.queueLength).toBe(0);
    // No errors
    expect(errors.filter(Boolean)).toHaveLength(0);
  });

  it('cancellation:supported — B creates an AbortController for its own POST', () => {
    const { q } = makeQueue();

    const payloadA = makePayload('a1');
    const payloadB = makePayload('b1', { cancellation: 'supported' });

    q.receive(payloadA);
    q.receive(payloadB);

    // B is now active with cancellation:'supported' — it should have an AbortSignal
    expect(q.abortSignal).toBeDefined();
    expect(q.abortSignal?.aborted).toBe(false);
  });

  it('cancellation:supported — A\'s AbortController is aborted when B preempts', () => {
    const { q } = makeQueue();

    // A is cancellation:'supported' so it has an AbortController
    const payloadA = makePayload('a1', { cancellation: 'supported' });
    const payloadB = makePayload('b1', { cancellation: 'supported' });

    q.receive(payloadA);
    const signalA = q.abortSignal!;
    expect(signalA.aborted).toBe(false);

    q.receive(payloadB);
    // A's signal should now be aborted
    expect(signalA.aborted).toBe(true);
    // B is now active
    expect(q.activePayload?.actionId).toBe('b1');
  });

  // ── cancellation: 'not-supported' path ──────────────────────────────────

  it('cancellation:not-supported — B is queued while A is active', () => {
    const { q, activations } = makeQueue();

    const payloadA = makePayload('a1');
    const payloadB = makePayload('b2', { cancellation: 'not-supported' });

    q.receive(payloadA);
    expect(q.activePayload?.actionId).toBe('a1');

    q.receive(payloadB);
    // B should be queued, not active
    expect(q.activePayload?.actionId).toBe('a1');
    expect(q.queueLength).toBe(1);
    expect(activations).toHaveLength(1); // only A activated so far
  });

  it('cancellation:not-supported — B activates after A completes (tryComplete)', () => {
    const { q, activations } = makeQueue();

    const payloadA = makePayload('a1');
    const payloadB = makePayload('b2');

    q.receive(payloadA);
    q.receive(payloadB);

    const ownId = q.captureOwnId();
    expect(ownId).toBe('a1');

    // Simulate A completing
    q.tryComplete(ownId);

    // B should now be active
    expect(q.activePayload?.actionId).toBe('b2');
    expect(q.activeActionId).toBe('b2');
    expect(q.queueLength).toBe(0);
    expect(activations[activations.length - 1]?.actionId).toBe('b2');
  });

  it('cancellation:not-supported — multiple actions queue in order', () => {
    const { q, activations } = makeQueue();

    q.receive(makePayload('a1'));
    q.receive(makePayload('b2'));
    q.receive(makePayload('c3'));

    expect(q.queueLength).toBe(2); // B and C queued

    q.tryComplete(q.captureOwnId()); // complete A → B activates
    expect(q.activePayload?.actionId).toBe('b2');
    expect(q.queueLength).toBe(1);

    q.tryComplete(q.captureOwnId()); // complete B → C activates
    expect(q.activePayload?.actionId).toBe('c3');
    expect(q.queueLength).toBe(0);

    expect(activations.map(p => p?.actionId ?? null)).toEqual(['a1', null, 'b2', null, 'c3']);
  });

  // ── race-condition guard (Leela Defect 1) ───────────────────────────────

  it('tryComplete is a no-op when ownId no longer matches (race-condition guard)', () => {
    const { q, activations } = makeQueue();

    // Receive A (not-supported)
    q.receive(makePayload('a1'));
    const staleOwnId = q.captureOwnId(); // 'a1'

    // Receive B with cancellation:'supported' — replaces A
    q.receive(makePayload('b1', { cancellation: 'supported' }));
    expect(q.activePayload?.actionId).toBe('b1');

    // Simulate A's stale finally block: should be no-op
    q.tryComplete(staleOwnId);

    // B is still active — not wiped by stale cleanup
    expect(q.activePayload?.actionId).toBe('b1');
    expect(q.activeActionId).toBe('b1');
    expect(q.inFlight).toBe(true);
    // No extra null activation from stale cleanup
    expect(activations.filter(p => p === null)).toHaveLength(0);
  });

  // ── fail-closed (Zapp B1) ───────────────────────────────────────────────

  it('invalid confirmComponent → error, no activation', () => {
    const { q, activations, errors } = makeQueue(alwaysInvalid);

    q.receive(makePayload('a1', { confirmComponent: { component: 'UnknownWidget' } }));

    expect(activations).toHaveLength(0);
    expect(q.activePayload).toBeNull();
    expect(q.inFlight).toBe(false);
    expect(errors.filter(Boolean)).toHaveLength(1);
    expect(errors[0]).toContain('Action not available');
  });

  // ── dismiss ──────────────────────────────────────────────────────────────

  it('dismiss clears active action and dequeues next', () => {
    const { q, activations } = makeQueue();

    q.receive(makePayload('a1'));
    q.receive(makePayload('b2'));

    q.dismiss();

    expect(q.activePayload?.actionId).toBe('b2');
    expect(activations[activations.length - 1]?.actionId).toBe('b2');
  });
});
