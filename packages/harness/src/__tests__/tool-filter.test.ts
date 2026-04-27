/**
 * Unit tests for callModelInputFilter, isLargeToolResult, and summarizeToolResult (#103).
 */

import { describe, expect, it } from 'vitest';
import {
  isLargeToolResult,
  summarizeToolResult,
  callModelInputFilter,
  TOOL_RESULT_MAX_CHARS,
} from '../runtime/runner.js';
import type { AgentInputItem } from '@openai/agents';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFunctionCallResult(output: string): AgentInputItem {
  return {
    type: 'function_call_result',
    name: 'test.tool',
    callId: 'call-1',
    status: 'completed',
    output,
  } as unknown as AgentInputItem;
}

function makeUserMessage(text: string): AgentInputItem {
  return { role: 'user', content: text } as unknown as AgentInputItem;
}

// ── isLargeToolResult ─────────────────────────────────────────────────────────

describe('isLargeToolResult', () => {
  it('returns false for non-function_call_result items', () => {
    expect(isLargeToolResult(makeUserMessage('hello'))).toBe(false);
  });

  it('returns false for a short tool result', () => {
    expect(isLargeToolResult(makeFunctionCallResult('short output'))).toBe(false);
  });

  it('returns true for output exceeding TOOL_RESULT_MAX_CHARS', () => {
    const longOutput = 'x'.repeat(TOOL_RESULT_MAX_CHARS + 1);
    expect(isLargeToolResult(makeFunctionCallResult(longOutput))).toBe(true);
  });

  it('returns false for output exactly at the limit', () => {
    const exactOutput = 'x'.repeat(TOOL_RESULT_MAX_CHARS);
    expect(isLargeToolResult(makeFunctionCallResult(exactOutput))).toBe(false);
  });
});

// ── summarizeToolResult ───────────────────────────────────────────────────────

describe('summarizeToolResult', () => {
  it('truncates output to TOOL_RESULT_MAX_CHARS and appends "[... truncated]"', () => {
    const longOutput = 'a'.repeat(5000);
    const item = makeFunctionCallResult(longOutput);
    const summarized = summarizeToolResult(item);
    const output = (summarized as { output?: string }).output!;
    expect(output).toHaveLength(TOOL_RESULT_MAX_CHARS + '[... truncated]'.length);
    expect(output.endsWith('[... truncated]')).toBe(true);
    expect(output.startsWith('a'.repeat(TOOL_RESULT_MAX_CHARS))).toBe(true);
  });

  it('does not mutate the original item', () => {
    const longOutput = 'b'.repeat(5000);
    const item = makeFunctionCallResult(longOutput);
    summarizeToolResult(item);
    expect((item as { output?: string }).output).toHaveLength(5000);
  });

  it('preserves other item fields', () => {
    const item = makeFunctionCallResult('x'.repeat(5000));
    const summarized = summarizeToolResult(item);
    expect((summarized as { callId?: string }).callId).toBe('call-1');
    expect((summarized as { name?: string }).name).toBe('test.tool');
    expect((summarized as { type?: string }).type).toBe('function_call_result');
  });
});

// ── callModelInputFilter ──────────────────────────────────────────────────────

describe('callModelInputFilter', () => {
  const makeArgs = (items: AgentInputItem[]) => ({
    modelData: { input: items },
    agent: {} as never,
    context: undefined,
  });

  it('passes through short items unchanged', () => {
    const items = [makeUserMessage('hi'), makeFunctionCallResult('short')];
    const result = callModelInputFilter(makeArgs(items));
    expect(result.input).toHaveLength(2);
    expect((result.input[1] as { output?: string }).output).toBe('short');
  });

  it('summarises large tool result items', () => {
    const longOutput = 'z'.repeat(TOOL_RESULT_MAX_CHARS + 100);
    const items = [makeFunctionCallResult(longOutput)];
    const result = callModelInputFilter(makeArgs(items));
    const output = (result.input[0] as { output?: string }).output!;
    expect(output.endsWith('[... truncated]')).toBe(true);
    expect(output.length).toBeLessThan(longOutput.length);
  });

  it('leaves user message items untouched even if long', () => {
    const longMsg = 'q'.repeat(TOOL_RESULT_MAX_CHARS + 100);
    const items = [makeUserMessage(longMsg)];
    const result = callModelInputFilter(makeArgs(items));
    expect(result.input[0]).toBe(items[0]);
  });

  it('preserves model data instructions when present', () => {
    const items: AgentInputItem[] = [];
    const result = callModelInputFilter({
      modelData: { input: items, instructions: 'be concise' },
      agent: {} as never,
      context: undefined,
    });
    expect(result.instructions).toBe('be concise');
  });
});
