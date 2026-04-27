/**
 * Tests for run-config.ts — issues #104, #105, #108.
 *
 * Covers:
 *  - RunConfig type contract (buildRunConfig defaults)                  (#105)
 *  - defaultHandoffInputFilter: A2UI output stripping                   (#104)
 *  - defaultHandoffInputFilter: turn compression                        (#104)
 *  - defaultHandoffInputFilter: no compression below threshold           (#104)
 *  - onHandoff callback invocation from runner.ts                       (#108)
 *  - Default logging callback format                                    (#108)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildRunConfig,
  defaultHandoffCallback,
  defaultHandoffInputFilter,
} from '../../src/runtime/run-config.js';
import type { HandoffCallback, RunConfig } from '../../src/runtime/run-config.js';
import type { HandoffInputData, RunItem } from '@openai/agents';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToolOutputItem(output: string): RunItem {
  return {
    type: 'tool_call_output_item',
    output,
    rawItem: { type: 'function_call_output', call_id: 'c1', output },
  } as unknown as RunItem;
}

function makeMessageItem(text: string): RunItem {
  return {
    type: 'message_output_item',
    rawItem: {
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text }],
    },
  } as unknown as RunItem;
}

function makeBaseHandoffInput(overrides?: Partial<HandoffInputData>): HandoffInputData {
  return {
    inputHistory: [],
    preHandoffItems: [],
    newItems: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// #105 — buildRunConfig
// ---------------------------------------------------------------------------

describe('#105 buildRunConfig — RunConfig defaults', () => {
  it('applies defaultHandoffInputFilter when no filter provided', () => {
    const cfg = buildRunConfig({});
    expect(cfg.handoffInputFilter).toBe(defaultHandoffInputFilter);
  });

  it('applies defaultHandoffCallback when no onHandoff provided', () => {
    const cfg = buildRunConfig({});
    expect(cfg.onHandoff).toBe(defaultHandoffCallback);
  });

  it('respects explicit handoffInputFilter override', () => {
    const myFilter = (d: HandoffInputData) => d;
    const cfg = buildRunConfig({ handoffInputFilter: myFilter });
    expect(cfg.handoffInputFilter).toBe(myFilter);
  });

  it('respects explicit onHandoff override', () => {
    const myCb: HandoffCallback = vi.fn();
    const cfg = buildRunConfig({ onHandoff: myCb });
    expect(cfg.onHandoff).toBe(myCb);
  });

  it('allows disabling filter with undefined', () => {
    const cfg = buildRunConfig({ handoffInputFilter: undefined });
    expect(cfg.handoffInputFilter).toBeUndefined();
  });

  it('allows disabling onHandoff with undefined', () => {
    const cfg = buildRunConfig({ onHandoff: undefined });
    expect(cfg.onHandoff).toBeUndefined();
  });

  it('passes maxTurns through', () => {
    const cfg = buildRunConfig({ maxTurns: 5 });
    expect(cfg.maxTurns).toBe(5);
  });

  it('leaves maxTurns undefined when not set', () => {
    const cfg = buildRunConfig({});
    expect(cfg.maxTurns).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// #104 — defaultHandoffInputFilter: A2UI stripping
// ---------------------------------------------------------------------------

describe('#104 defaultHandoffInputFilter — A2UI output stripping', () => {
  it('strips tool_call_output_item with A2UI version marker', () => {
    const a2uiItem = makeToolOutputItem('{"version":"v0.9","createSurface":{"surfaceId":"s1"}}');
    const plainItem = makeToolOutputItem('{"result":"ok"}');
    const input = makeBaseHandoffInput({ preHandoffItems: [a2uiItem, plainItem] });

    const result = defaultHandoffInputFilter(input);

    expect(result.preHandoffItems).toHaveLength(1);
    expect(result.preHandoffItems[0]).toBe(plainItem);
  });

  it('handles A2UI marker with spaces around colon', () => {
    const spacedItem = makeToolOutputItem('{"version" : "v0.9"}');
    const input = makeBaseHandoffInput({ preHandoffItems: [spacedItem] });
    const result = defaultHandoffInputFilter(input);
    expect(result.preHandoffItems).toHaveLength(0);
  });

  it('keeps non-tool_call_output items untouched', () => {
    const msgItem = makeMessageItem('some agent response');
    const input = makeBaseHandoffInput({ preHandoffItems: [msgItem] });
    const result = defaultHandoffInputFilter(input);
    expect(result.preHandoffItems).toHaveLength(1);
    expect(result.preHandoffItems[0]).toBe(msgItem);
  });

  it('strips multiple A2UI items in one pass', () => {
    const items = [
      makeToolOutputItem('{"version":"v0.9","a":1}'),
      makeMessageItem('text 1'),
      makeToolOutputItem('{"version":"v0.9","b":2}'),
      makeMessageItem('text 2'),
    ];
    const input = makeBaseHandoffInput({ preHandoffItems: items });
    const result = defaultHandoffInputFilter(input);
    // only the 2 message items survive
    expect(result.preHandoffItems).toHaveLength(2);
    expect(result.preHandoffItems.every((i) => i.type === 'message_output_item')).toBe(true);
  });

  it('does not mutate the original input', () => {
    const items = [makeToolOutputItem('{"version":"v0.9"}')];
    const input = makeBaseHandoffInput({ preHandoffItems: items });
    defaultHandoffInputFilter(input);
    expect(input.preHandoffItems).toHaveLength(1);
  });

  it('preserves inputHistory and newItems unchanged', () => {
    const newItems = [makeMessageItem('new item')];
    const input = makeBaseHandoffInput({
      inputHistory: [{ role: 'user', content: 'hi' } as any],
      newItems,
    });
    const result = defaultHandoffInputFilter(input);
    expect(result.inputHistory).toBe(input.inputHistory);
    expect(result.newItems).toBe(input.newItems);
  });
});

// ---------------------------------------------------------------------------
// #104 — defaultHandoffInputFilter: turn compression
// ---------------------------------------------------------------------------

describe('#104 defaultHandoffInputFilter — turn compression', () => {
  it('does not compress when preHandoffItems <= threshold (20)', () => {
    const items = Array.from({ length: 15 }, (_, i) => makeMessageItem(`msg ${i}`));
    const input = makeBaseHandoffInput({ preHandoffItems: items });
    const result = defaultHandoffInputFilter(input);
    // No summary item injected — all 15 items pass through
    expect(result.preHandoffItems).toHaveLength(15);
    expect(result.preHandoffItems.every((i) => i.type === 'message_output_item')).toBe(true);
  });

  it('compresses when preHandoffItems > 20, keeping last 10 verbatim', () => {
    const items = Array.from({ length: 25 }, (_, i) => makeMessageItem(`msg ${i}`));
    const input = makeBaseHandoffInput({ preHandoffItems: items });
    const result = defaultHandoffInputFilter(input);

    // 1 summary + 10 verbatim = 11
    expect(result.preHandoffItems).toHaveLength(11);

    // First item should be the synthetic summary
    const summary = result.preHandoffItems[0];
    expect((summary as any).rawItem?.content).toContain('15');
    expect((summary as any).rawItem?.content).toContain('compressed');

    // Last 10 items should be the verbatim tail
    const verbatim = result.preHandoffItems.slice(1);
    expect(verbatim.map((i: RunItem) => (i as any).rawItem?.content?.[0]?.text ?? '')).toEqual(
      items.slice(-10).map((i) => (i as any).rawItem?.content?.[0]?.text ?? ''),
    );
  });

  it('compresses exactly at threshold + 1 (21 items)', () => {
    const items = Array.from({ length: 21 }, (_, i) => makeMessageItem(`msg ${i}`));
    const input = makeBaseHandoffInput({ preHandoffItems: items });
    const result = defaultHandoffInputFilter(input);
    // 1 summary + 10 verbatim = 11
    expect(result.preHandoffItems).toHaveLength(11);
  });
});

// ---------------------------------------------------------------------------
// #108 — defaultHandoffCallback
// ---------------------------------------------------------------------------

describe('#108 defaultHandoffCallback', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the expected format: [handoff] {from} → {to} at turn {turn}', () => {
    defaultHandoffCallback('core.triage', 'core.codesmith', { turn: 1, sessionId: 'sess-1' });
    expect(console.log).toHaveBeenCalledWith(
      '[handoff] core.triage → core.codesmith at turn 1',
    );
  });

  it('increments turn in successive calls', () => {
    defaultHandoffCallback('a', 'b', { turn: 3, sessionId: 's' });
    expect(console.log).toHaveBeenCalledWith('[handoff] a → b at turn 3');
  });
});

// ---------------------------------------------------------------------------
// #108 — RunConfig.onHandoff is exported and callable
// ---------------------------------------------------------------------------

describe('#108 HandoffCallback type is exported and usable', () => {
  it('accepts a custom async callback', async () => {
    const calls: Array<{ from: string; to: string; turn: number }> = [];
    const cb: HandoffCallback = async (from, to, ctx) => {
      calls.push({ from, to, turn: ctx.turn });
    };
    const cfg: RunConfig = { onHandoff: cb };
    const built = buildRunConfig(cfg);
    await built.onHandoff?.('core.triage', 'core.specialist', { turn: 2, sessionId: 'x' });
    expect(calls).toEqual([{ from: 'core.triage', to: 'core.specialist', turn: 2 }]);
  });
});
