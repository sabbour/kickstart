import { describe, expect, it } from 'vitest';

import {
  CONVERSATION_PHASE_ORDER,
  extractConversationPhase,
  normalizeConversationPhase,
} from '../a2ui/chat-a2ui.js';

describe('chat-a2ui phase normalization', () => {
  it('accepts the canonical handoff phase', () => {
    expect(normalizeConversationPhase('handoff')).toBe('handoff');
  });

  it('maps legacy assess to handoff', () => {
    expect(normalizeConversationPhase('assess')).toBe('handoff');
  });

  it('uses the canonical brief phase order', () => {
    expect(CONVERSATION_PHASE_ORDER).toEqual([
      'discover',
      'design',
      'generate',
      'review',
      'handoff',
      'deploy',
    ]);
  });

  it('extracts handoff from ConversationPhase components', () => {
    expect(extractConversationPhase([
      {
        component: 'ConversationPhase',
        currentPhase: 'handoff',
      },
    ])).toBe('handoff');
  });

  it('rejects legacy-only phases', () => {
    expect(normalizeConversationPhase('triage')).toBeNull();
  });
});
