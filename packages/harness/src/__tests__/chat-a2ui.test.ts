import { describe, expect, it } from 'vitest';

import {
  CONVERSATION_PHASE_ORDER,
  extractConversationPhase,
  normalizeConversationPhase,
  prepareChatA2ui,
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

describe('scopeSurfaceId — shared: namespace (Phase E)', () => {
  it('shared: surfaceId bypasses turn-scoping prefix', () => {
    const items = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'shared:triage-main', catalogId: 'kickstart' },
      },
    ];
    const { renderableMessages } = prepareChatA2ui(items as any, 'assistant-turn-1');
    const createMsg = renderableMessages.find((m: any) => 'createSurface' in m) as any;
    expect(createMsg).toBeDefined();
    // Must NOT have the turn prefix — shared: surfaces are global.
    expect(createMsg.createSurface.surfaceId).toBe('shared:triage-main');
    expect(createMsg.createSurface.surfaceId).not.toContain('assistant-turn-1');
  });

  it('non-shared surfaceId gets turn-scoping prefix', () => {
    const items = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'my-card', catalogId: 'kickstart' },
      },
    ];
    const { renderableMessages } = prepareChatA2ui(items as any, 'assistant-turn-2');
    const createMsg = renderableMessages.find((m: any) => 'createSurface' in m) as any;
    expect(createMsg).toBeDefined();
    expect(createMsg.createSurface.surfaceId).toMatch(/^assistant-turn-2::/);
  });

  it('shared: updateComponents surfaceId bypasses turn-scoping prefix', () => {
    const items = [
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'shared:plan-surface',
          components: [{ type: 'Text', text: 'hello' }],
        },
      },
    ];
    const { renderableMessages } = prepareChatA2ui(items as any, 'assistant-turn-3');
    const updateMsg = renderableMessages.find((m: any) => 'updateComponents' in m) as any;
    expect(updateMsg).toBeDefined();
    expect(updateMsg.updateComponents.surfaceId).toBe('shared:plan-surface');
    expect(updateMsg.updateComponents.surfaceId).not.toContain('assistant-turn-3');
  });
});
