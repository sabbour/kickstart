import { describe, expect, it } from 'vitest';

import {
  CONVERSATION_PHASE_ORDER,
  extractConversationPhase,
  normalizeConversationPhase,
} from '../a2ui/chat-a2ui.js';

describe('chat-a2ui phase normalization', () => {
  it('accepts the current harness assess phase', () => {
    expect(normalizeConversationPhase('assess')).toBe('assess');
  });

  it('maps legacy handoff to assess', () => {
    expect(normalizeConversationPhase('handoff')).toBe('assess');
  });

  it('uses the current harness phase order', () => {
    expect(CONVERSATION_PHASE_ORDER).toEqual([
      'discover',
      'assess',
      'design',
      'generate',
      'review',
      'deploy',
    ]);
  });

  it('extracts assess from ConversationPhase components', () => {
    expect(extractConversationPhase([
      {
        component: 'ConversationPhase',
        currentPhase: 'assess',
      },
    ])).toBe('assess');
  });

  it('rejects legacy-only phases', () => {
    expect(normalizeConversationPhase('triage')).toBeNull();
  });
});
