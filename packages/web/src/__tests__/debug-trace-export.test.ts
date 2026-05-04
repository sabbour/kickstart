/**
 * Unit tests for buildConversationTrace — the pure trace-assembly function
 * exported from DebugTraceExport. Tests run without a React rendering context.
 */

import { describe, expect, it } from 'vitest';
import { buildConversationTrace } from '../components/Chat/DebugTraceExport';
import type { ChatMessage, ActionDebugEvent } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const userMsg: ChatMessage = {
  id: 'msg-1',
  role: 'user',
  text: 'What is AKS?',
  timestamp: 1000,
};

const assistantMsg: ChatMessage = {
  id: 'msg-2',
  role: 'assistant',
  text: 'AKS is Azure Kubernetes Service.',
  timestamp: 2000,
  model: 'gpt-4o',
  debugInfo: {
    model: 'gpt-4o',
    agentName: 'core.triage',
    skillsExecuted: ['aks-overview'],
    toolsExecuted: [{ name: 'core.emit_ui', status: 'ok' }],
  },
};

const actionEvent: ActionDebugEvent = {
  actionName: 'choose_build',
  category: 'user-action',
  context: { surfaceId: 'svc-1' },
  outboundMessage: 'I want to build a new cluster.',
  timestamp: 1500,
};

// ---------------------------------------------------------------------------
// buildConversationTrace
// ---------------------------------------------------------------------------

describe('buildConversationTrace', () => {
  it('includes all messages in turns', () => {
    const trace = buildConversationTrace([userMsg, assistantMsg], [], 'sess-abc');
    expect(trace.turns).toHaveLength(2);
    expect(trace.turns[0].id).toBe('msg-1');
    expect(trace.turns[1].id).toBe('msg-2');
  });

  it('includes the actionLog', () => {
    const trace = buildConversationTrace([userMsg], [actionEvent], 'sess-abc');
    expect(trace.actionLog).toHaveLength(1);
    expect(trace.actionLog[0].actionName).toBe('choose_build');
  });

  it('includes the sessionId', () => {
    const trace = buildConversationTrace([], [], 'sess-abc');
    expect(trace.sessionId).toBe('sess-abc');
  });

  it('handles undefined sessionId', () => {
    const trace = buildConversationTrace([], [], undefined);
    expect(trace.sessionId).toBeUndefined();
  });

  it('sets exportedAt to a valid ISO 8601 string', () => {
    const trace = buildConversationTrace([], [], undefined);
    expect(() => new Date(trace.exportedAt)).not.toThrow();
    expect(new Date(trace.exportedAt).toISOString()).toBe(trace.exportedAt);
  });

  it('preserves debugInfo on assistant turns', () => {
    const trace = buildConversationTrace([assistantMsg], [], undefined);
    expect(trace.turns[0].debugInfo?.agentName).toBe('core.triage');
    expect(trace.turns[0].debugInfo?.toolsExecuted).toHaveLength(1);
  });

  it('produces valid JSON when serialized', () => {
    const trace = buildConversationTrace([userMsg, assistantMsg], [actionEvent], 'sess-abc');
    const json = JSON.stringify(trace, null, 2);
    expect(() => JSON.parse(json)).not.toThrow();
    const reparsed = JSON.parse(json);
    expect(reparsed.turns).toHaveLength(2);
    expect(reparsed.actionLog).toHaveLength(1);
  });
});
