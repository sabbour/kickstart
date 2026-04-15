import { describe, expect, it } from 'vitest';
import type { ChatMessage, A2uiPayloadItem } from '../types';
import { getLatestConversationPhase, prepareChatA2uiPayload } from './chat-a2ui';

describe('prepareChatA2uiPayload', () => {
  it('extracts the phase indicator and namespaces renderable surface ids per turn', () => {
    const payload: A2uiPayloadItem[] = [
      {
        type: 'ConversationPhase',
        id: 'phase-indicator',
        currentPhase: 'discover',
        phases: [
          { id: 'discover', status: 'active' },
          { id: 'design', status: 'pending' },
        ],
      },
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'msg-1', catalogId: 'kickstart' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'msg-1',
          components: [{ id: 'root', component: 'Text', text: 'Hello there' }],
        },
      },
    ];

    const prepared = prepareChatA2uiPayload(payload, 'assistant-turn-1');

    expect(prepared.phase).toBe('discover');
    expect(prepared.messages).toEqual([
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'assistant-turn-1::msg-1', catalogId: 'kickstart' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'assistant-turn-1::msg-1',
          components: [{ id: 'root', component: 'Text', text: 'Hello there' }],
        },
      },
    ]);
  });

  it('drops inline ConversationPhase components while preserving the rest of the surface', () => {
    const payload: A2uiPayloadItem[] = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'msg-1', catalogId: 'kickstart' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'msg-1',
          components: [
            { id: 'phase-indicator', component: 'ConversationPhase', currentPhase: 'build' },
            { id: 'summary', component: 'Text', text: 'Ready to continue' },
          ],
        },
      },
    ];

    const prepared = prepareChatA2uiPayload(payload, 'assistant-turn-2');

    expect(prepared.phase).toBe('generate');
    expect(prepared.messages).toEqual([
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'assistant-turn-2::msg-1', catalogId: 'kickstart' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'assistant-turn-2::msg-1',
          components: [{ id: 'summary', component: 'Text', text: 'Ready to continue' }],
        },
      },
    ]);
  });
});

describe('getLatestConversationPhase', () => {
  it('recovers the persisted phase from stored A2UI payload when the message field is empty', () => {
    const messages: ChatMessage[] = [
      {
        id: 'assistant-turn-3',
        role: 'assistant',
        text: 'Still reviewing your setup.',
        timestamp: 0,
        a2uiMessages: [
          {
            type: 'ConversationPhase',
            id: 'phase-indicator',
            currentPhase: 'review',
          },
        ],
      },
    ];

    expect(getLatestConversationPhase(messages)).toBe('review');
  });

  it('falls back to debug envelope payloads for older assistant turns', () => {
    const messages: ChatMessage[] = [
      {
        id: 'assistant-turn-4',
        role: 'assistant',
        text: 'Initial guidance',
        phase: 'discover',
        timestamp: 0,
      },
      {
        id: 'assistant-turn-5',
        role: 'assistant',
        text: '',
        timestamp: 1,
        debugInfo: {
          fullEnvelope: {
            a2ui: [
              {
                type: 'ConversationPhase',
                id: 'phase-indicator',
                currentPhase: 'validate',
              },
            ],
          },
        },
      },
    ];

    expect(getLatestConversationPhase(messages)).toBe('review');
  });
});
