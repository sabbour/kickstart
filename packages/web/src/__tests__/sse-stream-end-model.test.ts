/**
 * Unit tests for _processSSEStream — verifying that the `end` SSE event
 * correctly surfaces the model name and that the `chunk` events accumulate
 * prose (not raw JSON tokens).
 *
 * Follows the same exported-helper / injectable-stream pattern as
 * streaming-406-fallback.test.ts (`_performSdkNonStreamingFetch`).
 *
 * Covers #943: model name missing from SSE stream (Debug panel showed
 * "Model: Not available").  The `end` event must carry `model` and the
 * stream processor must expose it on the returned SSEStreamResult.
 */

import { describe, expect, it, vi } from 'vitest';
import { _processSSEStream } from '../hooks/useStreaming';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encode an SSE frame as a Uint8Array, matching server output from formatSSEFrame(). */
function sseFrame(eventType: string, data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Build a ReadableStream<Uint8Array> from an array of pre-encoded SSE frames. */
function makeSSEStream(frames: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(frame);
      controller.close();
    },
  });
}

// ---------------------------------------------------------------------------
// #943 — end event carries model name
// ---------------------------------------------------------------------------

describe('_processSSEStream — end event model field (#943)', () => {
  it('returns the model name from the end event', async () => {
    const stream = makeSSEStream([
      sseFrame('start', { sessionId: 'sess-1' }),
      sseFrame('chunk', { delta: 'Hello there.' }),
      sseFrame('end', { sessionId: 'sess-1', intent: 'continue', model: 'gpt-5.4-mini' }),
    ]);

    const result = await _processSSEStream(stream, {});

    expect(result.model).toBe('gpt-5.4-mini');
    expect(result.sessionId).toBe('sess-1');
    expect(result.intent).toBe('continue');
    expect(result.accumulated).toBe('Hello there.');
  });

  it('returns model undefined when the end event has no model field (old server contract)', async () => {
    const stream = makeSSEStream([
      sseFrame('end', { sessionId: 'sess-2' }),
    ]);

    const result = await _processSSEStream(stream, {});

    expect(result.model).toBeUndefined();
    expect(result.sessionId).toBe('sess-2');
  });

  it('fires onIntent callback from the end event', async () => {
    const onIntent = vi.fn();
    const stream = makeSSEStream([
      sseFrame('end', { sessionId: 's', intent: 'advance', model: 'gpt-4.1' }),
    ]);

    const result = await _processSSEStream(stream, { onIntent });

    expect(onIntent).toHaveBeenCalledOnce();
    expect(onIntent).toHaveBeenCalledWith({ summary: 'advance' });
    expect(result.intent).toBe('advance');
    expect(result.model).toBe('gpt-4.1');
  });

  it('handles a stream with no end event (early close) without throwing', async () => {
    const stream = makeSSEStream([
      sseFrame('start', { sessionId: 'sess-x' }),
      sseFrame('chunk', { delta: 'partial text' }),
    ]);

    const result = await _processSSEStream(stream, {});

    expect(result.model).toBeUndefined();
    expect(result.accumulated).toBe('partial text');
  });
});

// ---------------------------------------------------------------------------
// #937 — chunk events accumulate prose, not raw JSON tokens
// ---------------------------------------------------------------------------

describe('_processSSEStream — chunk accumulation (#937 regression guard)', () => {
  it('accumulates clean prose deltas from chunk events', async () => {
    const stream = makeSSEStream([
      sseFrame('start', { sessionId: 's1' }),
      sseFrame('chunk', { delta: 'Great ' }),
      sseFrame('chunk', { delta: 'idea.' }),
      sseFrame('end', { sessionId: 's1', model: 'gpt-5-mini' }),
    ]);

    const chunks: string[] = [];
    const result = await _processSSEStream(stream, {
      onChunk: (text) => chunks.push(text),
    });

    expect(result.accumulated).toBe('Great idea.');
    expect(chunks).toEqual(['Great ', 'Great idea.']);
  });

  it('does NOT accumulate raw JSON when the runner correctly extracts prose (regression for #937)', async () => {
    // After the fix: the runner sends the prose string as the delta, not the AgentOutput JSON.
    // This test verifies that if correct prose deltas arrive, no JSON leaks into accumulated.
    const stream = makeSSEStream([
      sseFrame('chunk', { delta: 'I can help with that.' }),
      sseFrame('end', { model: 'gpt-5.4-mini' }),
    ]);

    const result = await _processSSEStream(stream, {});

    expect(result.accumulated).toBe('I can help with that.');
    expect(result.accumulated).not.toContain('{');
  });
});

// ---------------------------------------------------------------------------
// Error and phase events
// ---------------------------------------------------------------------------

describe('_processSSEStream — error and phase events', () => {
  it('calls onError and returns early on an error event', async () => {
    const onError = vi.fn();
    const stream = makeSSEStream([
      sseFrame('chunk', { delta: 'partial' }),
      sseFrame('error', { message: 'GUARDRAIL_BLOCK' }),
      sseFrame('chunk', { delta: 'never-sent' }),
    ]);

    const result = await _processSSEStream(stream, { onError });

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith('GUARDRAIL_BLOCK');
    // Stream was cancelled — second chunk was not processed
    expect(result.accumulated).toBe('partial');
  });

  it('calls onPhase with the agent name from a phase event', async () => {
    const onPhase = vi.fn();
    const stream = makeSSEStream([
      sseFrame('phase', { agent: 'design-agent' }),
      sseFrame('end', { model: 'gpt-4.1' }),
    ]);

    await _processSSEStream(stream, { onPhase });

    expect(onPhase).toHaveBeenCalledOnce();
    expect(onPhase).toHaveBeenCalledWith('design-agent');
  });
});

// ---------------------------------------------------------------------------
// #958 — end event carries agentName, skillsExecuted, toolsExecuted
// ---------------------------------------------------------------------------

describe('_processSSEStream — debug fields in end event (#958)', () => {
  it('returns agentName, skillsExecuted, and toolsExecuted from the end event', async () => {
    const stream = makeSSEStream([
      sseFrame('start', { sessionId: 'sess-1' }),
      sseFrame('chunk', { delta: 'Sure!' }),
      sseFrame('end', {
        sessionId: 'sess-1',
        model: 'gpt-5.4-mini',
        agentName: 'core.triage',
        skillsExecuted: ['core/github-import'],
        toolsExecuted: [{ name: 'core.emit_ui', status: 'ok' }],
      }),
    ]);

    const result = await _processSSEStream(stream, {});

    expect(result.agentName).toBe('core.triage');
    expect(result.skillsExecuted).toEqual(['core/github-import']);
    expect(result.toolsExecuted).toEqual([{ name: 'core.emit_ui', status: 'ok' }]);
  });

  it('returns undefined for debug fields when the end event omits them (backward compat)', async () => {
    const stream = makeSSEStream([
      sseFrame('end', { sessionId: 's', model: 'gpt-5.4-mini' }),
    ]);

    const result = await _processSSEStream(stream, {});

    expect(result.agentName).toBeUndefined();
    expect(result.skillsExecuted).toBeUndefined();
    expect(result.toolsExecuted).toBeUndefined();
  });

  it('filters malformed toolsExecuted entries (type safety)', async () => {
    const stream = makeSSEStream([
      sseFrame('end', {
        model: 'gpt-5.4-mini',
        agentName: 'core.triage',
        toolsExecuted: [
          { name: 'core.emit_ui', status: 'ok' },
          { name: 42, status: 'ok' },       // malformed — name not a string
          { name: 'core.read_file' },        // malformed — missing status
          null,                              // malformed — not an object
        ],
      }),
    ]);

    const result = await _processSSEStream(stream, {});

    // Only the valid entry passes the type guard
    expect(result.toolsExecuted).toEqual([{ name: 'core.emit_ui', status: 'ok' }]);
  });

  it('reports multiple tool calls including errors', async () => {
    const stream = makeSSEStream([
      sseFrame('end', {
        model: 'gpt-5.4-mini',
        agentName: 'core.codesmith',
        skillsExecuted: [],
        toolsExecuted: [
          { name: 'core.fetch_webpage', status: 'ok' },
          { name: 'core.write_file', status: 'error' },
        ],
      }),
    ]);

    const result = await _processSSEStream(stream, {});

    expect(result.agentName).toBe('core.codesmith');
    expect(result.skillsExecuted).toEqual([]);
    expect(result.toolsExecuted).toHaveLength(2);
    expect(result.toolsExecuted?.[1]).toEqual({ name: 'core.write_file', status: 'error' });
  });
});
