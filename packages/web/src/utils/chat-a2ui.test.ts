import { describe, expect, it } from 'vitest';
import type { ChatMessage, A2uiPayloadItem } from '../types';
import {
  GENERATE_PROGRESS_TITLE,
  getLatestConversationPhase,
  prepareChatA2ui,
  prepareChatA2uiPayload,
} from './chat-a2ui';

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

describe('prepareChatA2ui', () => {
  it('replaces inline FileEditor components with compact file labels and extracts files', () => {
    const payload: A2uiPayloadItem[] = [
      {
        type: 'ConversationPhase',
        id: 'phase-indicator',
        currentPhase: 'generate',
        phases: [
          { id: 'discover', label: 'Discover', status: 'complete' },
          { id: 'generate', label: 'Generate', status: 'active' },
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
          components: [
            {
              id: 'progress',
              component: 'DeploymentProgress',
              steps: [{ id: 'dockerfile', label: 'Dockerfile', status: 'complete' }],
            },
            {
              id: 'file',
              component: 'FileEditor',
              filename: 'Dockerfile',
              language: 'dockerfile',
              content: 'FROM node:20-alpine',
            },
          ],
        },
      },
    ];

    const prepared = prepareChatA2ui(payload, 'assistant-turn-3');
    const renderableUpdate = prepared.renderableMessages[1].updateComponents;
    const storedUpdate = prepared.storedMessages[2];

    expect(prepared.phase).toBe('generate');
    expect(prepared.files).toEqual([
      {
        path: 'Dockerfile',
        content: 'FROM node:20-alpine',
        language: 'dockerfile',
      },
    ]);
    expect(renderableUpdate).toMatchObject({
      surfaceId: 'assistant-turn-3::msg-1',
      components: [
        {
          id: 'progress',
          component: 'DeploymentProgress',
          steps: [{ id: 'dockerfile', label: 'Dockerfile', status: 'complete' }],
          title: GENERATE_PROGRESS_TITLE,
        },
        {
          id: 'file',
          component: 'Text',
          text: '📄 Dockerfile',
          variant: 'subtitle2',
        },
      ],
    });
    expect('updateComponents' in storedUpdate && storedUpdate.updateComponents?.surfaceId).toBe('msg-1');
    expect('updateComponents' in storedUpdate && storedUpdate.updateComponents?.components[1]).toMatchObject({
      id: 'file',
      component: 'FileEditor',
      filename: 'Dockerfile',
      content: 'FROM node:20-alpine',
    });
  });

  it('expands multi-file FileEditor payloads into a compact list', () => {
    const payload: A2uiPayloadItem[] = [
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'msg-2',
          components: [
            {
              id: 'editor',
              component: 'FileEditor',
              files: [
                {
                  filename: 'src/index.ts',
                  language: 'typescript',
                  content: 'console.log("hi")',
                },
                {
                  filename: 'Dockerfile',
                  language: 'dockerfile',
                  content: 'FROM node:20-alpine',
                },
              ],
            },
          ],
        },
      },
    ];

    const prepared = prepareChatA2ui(payload, 'assistant-turn-4');

    expect(prepared.files.map((file) => file.path)).toEqual([
      'src/index.ts',
      'Dockerfile',
    ]);
    expect(prepared.renderableMessages[0].updateComponents).toMatchObject({
      surfaceId: 'assistant-turn-4::msg-2',
      components: [
        {
          id: 'editor',
          component: 'Column',
          children: ['editor__file_0', 'editor__file_1'],
          gap: 'small',
        },
        {
          id: 'editor__file_0',
          component: 'Text',
          text: '📄 src/index.ts',
          variant: 'subtitle2',
        },
        {
          id: 'editor__file_1',
          component: 'Text',
          text: '📄 Dockerfile',
          variant: 'subtitle2',
        },
      ],
    });
  });
});

describe('getLatestConversationPhase', () => {
  it('recovers the persisted phase from stored A2UI payload when the message field is empty', () => {
    const messages: ChatMessage[] = [
      {
        id: 'assistant-turn-5',
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
        id: 'assistant-turn-6',
        role: 'assistant',
        text: 'Initial guidance',
        phase: 'discover',
        timestamp: 0,
      },
      {
        id: 'assistant-turn-7',
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
