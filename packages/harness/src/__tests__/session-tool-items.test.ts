/**
 * Unit tests for Session.toolCallItems and recordToolCallRecord (#103).
 */

import { describe, expect, it } from 'vitest';
import { Session } from '../runtime/session.js';
import type { AgentInputItem } from '@openai/agents';

function makeFunctionCallItem(callId: string): AgentInputItem {
  return {
    type: 'function_call',
    name: 'test.tool',
    callId,
    status: 'completed',
    arguments: '{}',
  } as unknown as AgentInputItem;
}

function makeFunctionCallResultItem(callId: string): AgentInputItem {
  return {
    type: 'function_call_result',
    name: 'test.tool',
    callId,
    status: 'completed',
    output: 'result',
  } as unknown as AgentInputItem;
}

describe('Session.recordToolCallRecord (#103)', () => {
  it('stores tool call records', () => {
    const session = new Session({ sessionId: 's1', user: { oid: 'u1' } });
    session.recordToolCallRecord({
      callItem: makeFunctionCallItem('c1'),
      resultItem: makeFunctionCallResultItem('c1'),
    });
    expect(session.toolCallItems).toHaveLength(1);
    expect((session.toolCallItems[0].callItem as { callId?: string }).callId).toBe('c1');
  });

  it('starts with an empty toolCallItems array', () => {
    const session = new Session({ sessionId: 's2', user: { oid: 'u2' } });
    expect(session.toolCallItems).toHaveLength(0);
  });

  it('bounds toolCallItems to 200 entries (sliding window)', () => {
    const session = new Session({ sessionId: 's3', user: { oid: 'u3' } });
    for (let i = 0; i < 210; i++) {
      session.recordToolCallRecord({ callItem: makeFunctionCallItem(`c${i}`) });
    }
    expect(session.toolCallItems).toHaveLength(200);
    // The oldest 10 should have been trimmed; first item is c10.
    expect((session.toolCallItems[0].callItem as { callId?: string }).callId).toBe('c10');
  });

  it('records a call item without a result item', () => {
    const session = new Session({ sessionId: 's4', user: { oid: 'u4' } });
    session.recordToolCallRecord({ callItem: makeFunctionCallItem('c1') });
    expect(session.toolCallItems[0].resultItem).toBeUndefined();
  });
});
