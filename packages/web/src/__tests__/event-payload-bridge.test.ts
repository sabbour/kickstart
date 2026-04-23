/**
 * Layer 1 of #1062 (closes #1061): structured event payload bridge.
 *
 * The client must:
 *   (a) show the human-readable button label in the user bubble,
 *   (b) POST to /api/converse with structured `event` metadata alongside
 *       the human `message`, and
 *   (c) include the server-issued `sessionId` so the server can rehydrate
 *       conversation history (once Bender's Layer 0 lands).
 *
 * These tests exercise the two pure helpers on the client side:
 *   - `buildActionEventMetadata` in useActionDispatch (event shaping)
 *   - `_performSdkNonStreamingFetch` wire format (sessionId + message)
 *
 * They are intentionally narrow — the full end-to-end click → POST round-trip
 * is covered by the Playwright regression in
 * `packages/web/e2e/button-click-payload.spec.ts`.
 */

import { describe, expect, it, vi } from 'vitest';
import { buildActionEventMetadata } from '../hooks/useActionDispatch';
import { _performSdkNonStreamingFetch, _composeConverseRequestBody } from '../hooks/useStreaming';
import type { A2uiClientAction } from '../vendor/a2ui/web_core/schema/client-to-server';

describe('buildActionEventMetadata', () => {
  function baseAction(overrides: Partial<A2uiClientAction> = {}): A2uiClientAction {
    return {
      name: 'choose_build',
      surfaceId: 's1',
      sourceComponentId: 'btn-build',
      timestamp: '2026-04-22T10:00:00.000Z',
      context: {},
      ...overrides,
    };
  }

  it('extracts the raw event name (with no payload) when context is empty', () => {
    const result = buildActionEventMetadata(baseAction());
    expect(result).toEqual({ name: 'choose_build' });
  });

  it('extracts name + sanitized payload when context has values', () => {
    const result = buildActionEventMetadata(
      baseAction({
        context: {
          action: 'build', // dropped by sanitizer allowlist
          value: 'build',
          confirmed: true, // dropped by sanitizer allowlist
        },
      }),
    );
    expect(result?.name).toBe('choose_build');
    // The sanitizer allowlist only forwards a small set of keys — `value` is
    // one of them. `action` and `confirmed` are intentionally dropped before
    // the payload is sent to the server (prompt-injection hardening).
    expect(result?.payload).toEqual({ value: 'build' });
  });

  it('strips routing prefixes from the event name', () => {
    const result = buildActionEventMetadata(
      baseAction({ name: 'navigate:requirements' }),
    );
    expect(result?.name).toBe('requirements');
  });

  it('returns undefined when the action has no meaningful name', () => {
    expect(buildActionEventMetadata(baseAction({ name: '' }))).toBeUndefined();
  });
});

describe('_composeConverseRequestBody (Layer 1 POST wire contract)', () => {
  const base = {
    sessionId: 'sess-123',
    message: 'Build new',
    clientMessageId: 'cm-1',
    clientMessages: undefined,
  };

  it('carries sessionId + human message, no event when button is absent', () => {
    const body = _composeConverseRequestBody(base);
    expect(body).toMatchObject({
      sessionId: 'sess-123',
      message: 'Build new',
      stream: true,
      clientMessageId: 'cm-1',
    });
    expect(body.event).toBeUndefined();
  });

  it('attaches structured event metadata when a button click supplies one', () => {
    const body = _composeConverseRequestBody({
      ...base,
      event: {
        name: 'choose_build',
        payload: { action: 'build', value: 'build', confirmed: true },
      },
    });
    expect(body.message).toBe('Build new'); // user-facing bubble stays human
    expect(body.event).toEqual({
      name: 'choose_build',
      payload: { action: 'build', value: 'build', confirmed: true },
    });
  });

  it('omits payload from the event when none is provided', () => {
    const body = _composeConverseRequestBody({
      ...base,
      event: { name: 'choose_build' },
    });
    expect(body.event).toEqual({ name: 'choose_build' });
  });

  it('omits empty clientMessages array from the body', () => {
    const body = _composeConverseRequestBody({ ...base, clientMessages: [] });
    expect(body.messages).toBeUndefined();
  });

  it('forwards clientMessages when populated (session rehydration fallback)', () => {
    const body = _composeConverseRequestBody({
      ...base,
      clientMessages: [{ role: 'user', content: 'hello' }],
    });
    expect(body.messages).toEqual([{ role: 'user', content: 'hello' }]);
  });
});

describe('useStreaming POST body contract (sessionId + event carried alongside message)', () => {
  it('includes sessionId but no event field when event is absent (no-regression baseline)', async () => {
    const mockApiFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: 's-1', message: 'hi', model: 'm' }),
    });

    await _performSdkNonStreamingFetch(
      {
        sessionId: 'sess-existing',
        message: 'Build new',
        clientMessages: undefined,
        signal: new AbortController().signal,
        debugMode: false,
      },
      { onPhase: vi.fn(), onA2UI: vi.fn() },
      [],
      mockApiFetch as any,
    );

    expect(mockApiFetch).toHaveBeenCalledOnce();
    const call = mockApiFetch.mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.sessionId).toBe('sess-existing');
    expect(body.message).toBe('Build new');
    expect(body.event).toBeUndefined();
  });
});
