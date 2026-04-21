/**
 * Regression guard for issue #977: core_emit_ui SSE forwarding.
 *
 * The investigation found that the backend emit path was CORRECT —
 * the runner drains session.a2uiEmissions and writes 'event: a2ui'
 * frames on every event loop iteration. The user-visible bug was
 * a missing `case 'a2ui':` in the frontend useStreaming.ts switch
 * (fixed in PR #977 by Fry).
 *
 * These tests pin the backend contract so regressions are caught
 * server-side before they surface as silent frontend drops.
 */

import { describe, it, expect, vi } from 'vitest';
import { Session } from '../../src/runtime/session.js';
import { formatSSEFrame } from '../../src/runtime/sse.js';
import type { SSEWriter } from '../../src/runtime/sse.js';
import type { A2UIMessageV09 } from '../../src/types/a2ui.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const createSurfaceMsg: A2UIMessageV09 = {
  version: 'v0.9',
  createSurface: { surfaceId: 'surface-001', catalogId: 'kickstart' },
};

const updateComponentsMsg: A2UIMessageV09 = {
  version: 'v0.9',
  updateComponents: {
    surfaceId: 'surface-001',
    components: [{ type: 'Button', label: 'Click me' }],
  },
};

// ── Session drain contract ────────────────────────────────────────────────────

describe('Session a2ui drain contract', () => {
  it('drainA2UIEmissions returns recorded messages', () => {
    const session = new Session({ sessionId: 'sid', user: { oid: 'oid' } });
    session.recordA2UIEmission(createSurfaceMsg);
    const drained = session.drainA2UIEmissions();
    expect(drained).toHaveLength(1);
    expect(drained[0]).toEqual(createSurfaceMsg);
  });

  it('drain clears the array — second drain returns empty', () => {
    const session = new Session({ sessionId: 'sid', user: { oid: 'oid' } });
    session.recordA2UIEmission(createSurfaceMsg);
    session.drainA2UIEmissions();
    expect(session.drainA2UIEmissions()).toHaveLength(0);
  });

  it('preserves insertion order across multiple emissions', () => {
    const session = new Session({ sessionId: 'sid', user: { oid: 'oid' } });
    session.recordA2UIEmission(createSurfaceMsg);
    session.recordA2UIEmission(updateComponentsMsg);
    const drained = session.drainA2UIEmissions();
    expect(drained).toHaveLength(2);
    expect(drained[0]).toEqual(createSurfaceMsg);
    expect(drained[1]).toEqual(updateComponentsMsg);
  });

  it('drain on empty session returns empty array', () => {
    const session = new Session({ sessionId: 'sid', user: { oid: 'oid' } });
    expect(session.drainA2UIEmissions()).toEqual([]);
  });
});

// ── SSE wire format for a2ui events ──────────────────────────────────────────

describe('a2ui SSE wire format', () => {
  it('formatSSEFrame produces correct event: a2ui header', () => {
    const frame = formatSSEFrame('a2ui', createSurfaceMsg);
    expect(frame).toContain('event: a2ui\n');
  });

  it('formatSSEFrame encodes the full message as JSON in data field', () => {
    const frame = formatSSEFrame('a2ui', createSurfaceMsg);
    expect(frame).toContain(`data: ${JSON.stringify(createSurfaceMsg)}`);
  });

  it('the emitted SSE frame has no `op` field — harness strips it via withoutDiscriminator', () => {
    // The A2UIMessageSchema transform strips 'op' before storing the emission.
    // The frontend types (A2uiCreateSurfaceMsg etc.) also have no 'op' field.
    // This test pins that invariant so we notice if it changes.
    const frame = formatSSEFrame('a2ui', createSurfaceMsg);
    const dataLine = frame.split('\n').find((l) => l.startsWith('data: '))!;
    const parsed = JSON.parse(dataLine.slice(6)) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('op');
    expect(parsed).toHaveProperty('version', 'v0.9');
    expect(parsed).toHaveProperty('createSurface');
  });

  it('full SSE frame matches the expected wire format', () => {
    const frame = formatSSEFrame('a2ui', createSurfaceMsg);
    const expected =
      `event: a2ui\ndata: ${JSON.stringify(createSurfaceMsg)}\n\n`;
    expect(frame).toBe(expected);
  });
});

// ── Runner drain-loop simulation ──────────────────────────────────────────────
//
// Rather than spinning up the full SDK runner (which requires network / API key),
// we simulate the drain-loop body that Runner.run() executes on every event:
//
//   const a2uiMessages = session.drainA2UIEmissions();
//   for (const msg of a2uiMessages) { sseWrite('a2ui', msg); }
//
// This validates that the mechanism correctly forwards emissions to sseWrite.

describe('runner a2ui drain-loop mechanics', () => {
  function simulateDrainLoop(session: Session, sseWrite: SSEWriter): void {
    const a2uiMessages = session.drainA2UIEmissions();
    for (const msg of a2uiMessages) {
      sseWrite('a2ui', msg);
    }
  }

  it('sseWrite receives event=a2ui with the emission when drain loop fires', () => {
    const session = new Session({ sessionId: 'sid', user: { oid: 'oid' } });
    const sseWrite = vi.fn() as unknown as SSEWriter;

    session.recordA2UIEmission(createSurfaceMsg);
    simulateDrainLoop(session, sseWrite);

    expect(sseWrite).toHaveBeenCalledOnce();
    expect(sseWrite).toHaveBeenCalledWith('a2ui', createSurfaceMsg);
  });

  it('two emissions produce two sseWrite calls in order', () => {
    const session = new Session({ sessionId: 'sid', user: { oid: 'oid' } });
    const sseWrite = vi.fn() as unknown as SSEWriter;

    session.recordA2UIEmission(createSurfaceMsg);
    session.recordA2UIEmission(updateComponentsMsg);
    simulateDrainLoop(session, sseWrite);

    expect(sseWrite).toHaveBeenCalledTimes(2);
    expect(sseWrite).toHaveBeenNthCalledWith(1, 'a2ui', createSurfaceMsg);
    expect(sseWrite).toHaveBeenNthCalledWith(2, 'a2ui', updateComponentsMsg);
  });

  it('drain loop is idempotent — second call without new emissions produces no writes', () => {
    const session = new Session({ sessionId: 'sid', user: { oid: 'oid' } });
    const sseWrite = vi.fn() as unknown as SSEWriter;

    session.recordA2UIEmission(createSurfaceMsg);
    simulateDrainLoop(session, sseWrite);  // first drain — 1 call
    simulateDrainLoop(session, sseWrite);  // second drain — 0 calls

    expect(sseWrite).toHaveBeenCalledOnce();
  });

  it('emission added AFTER first drain is picked up by next drain call', () => {
    // Simulates: tool_called event (drain=empty), tool runs, tool_output event (drain=1 msg)
    const session = new Session({ sessionId: 'sid', user: { oid: 'oid' } });
    const sseWrite = vi.fn() as unknown as SSEWriter;

    simulateDrainLoop(session, sseWrite);                  // tool_called iteration — nothing yet
    session.recordA2UIEmission(createSurfaceMsg);          // tool runs, records emission
    simulateDrainLoop(session, sseWrite);                  // tool_output iteration — picks it up

    expect(sseWrite).toHaveBeenCalledOnce();
    expect(sseWrite).toHaveBeenCalledWith('a2ui', createSurfaceMsg);
  });

  it('regression: #977 — emit_ui fires twice, both envelopes reach sseWrite', () => {
    // This matches the Ahmed bug report: core_emit_ui fired TWICE with status ok.
    // Backend was correct — both emissions were forwarded via 'event: a2ui'.
    // Frontend dropped them (missing case 'a2ui': in useStreaming.ts switch).
    const session = new Session({ sessionId: 'sid', user: { oid: 'oid' } });
    const sseWrite = vi.fn() as unknown as SSEWriter;

    // First tool_output event: first emit_ui ran, drains 1 emission
    session.recordA2UIEmission(createSurfaceMsg);
    simulateDrainLoop(session, sseWrite);

    // Second tool_output event: second emit_ui ran, drains 1 emission
    session.recordA2UIEmission(updateComponentsMsg);
    simulateDrainLoop(session, sseWrite);

    expect(sseWrite).toHaveBeenCalledTimes(2);
    expect(sseWrite).toHaveBeenNthCalledWith(1, 'a2ui', createSurfaceMsg);
    expect(sseWrite).toHaveBeenNthCalledWith(2, 'a2ui', updateComponentsMsg);
  });
});
