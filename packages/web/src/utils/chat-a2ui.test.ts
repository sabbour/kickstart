import { describe, expect, it } from 'vitest';
import type { ChatMessage, A2uiPayloadItem, SetupGenerationEvent } from '../types';
import {
  GENERATION_PROGRESS_TITLE,
  claimSurfaceOwnership,
  getLatestConversationPhase,
  prepareStepwiseSetup,
  prepareChatA2ui,
  prepareChatA2uiPayload,
  redactSetupEvent,
  rebuildChatSessionState,
} from './chat-a2ui';

describe('prepareChatA2uiPayload', () => {
  it('extracts the phase indicator and namespaces renderable surface ids per turn', () => {
    const payload: A2uiPayloadItem[] = [
      {
        type: 'ConversationPhase',
        id: 'phase-indicator',
        currentPhase: 'discover',
        phases: [
          { id: 'discover', label: 'Discover', status: 'active' },
          { id: 'design', label: 'Design', status: 'pending' },
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
  it('replaces inline FileEditor components with workspace summaries and extracts files', () => {
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
              component: 'GenerationProgress',
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
          component: 'GenerationProgress',
          steps: [{ id: 'dockerfile', label: 'Dockerfile', status: 'complete' }],
          title: GENERATION_PROGRESS_TITLE,
        },
        {
          id: 'file',
          component: 'Text',
          text: '📄 Dockerfile is available in the workspace.',
          variant: 'body2',
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

  it('collapses multi-file FileEditor payloads into one workspace summary', () => {
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
                  path: 'src/index.ts',
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
          component: 'Text',
          text: '📄 2 generated files are available in the workspace.',
          variant: 'body2',
        },
      ],
    });
  });

  it('delivers artifact-backed files to the workspace while keeping chat output compact', () => {
    const payload: A2uiPayloadItem[] = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'msg-3', catalogId: 'kickstart' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'msg-3',
          components: [
            {
              id: 'artifact-file',
              component: 'FileEditor',
              filename: 'infra/main.bicep',
              artifactPath: 'artifacts/infra/main.bicep',
            },
          ],
        },
      },
    ];

    const prepared = prepareChatA2ui(payload, 'assistant-turn-5', {
      resolveArtifactContent: (artifactPath) => artifactPath === 'artifacts/infra/main.bicep'
        ? 'param location string = resourceGroup().location'
        : null,
    });
    const renderableUpdate = prepared.renderableMessages[1].updateComponents;
    const storedUpdate = prepared.storedMessages[1];

    expect(prepared.files).toEqual([
      {
        path: 'infra/main.bicep',
        content: 'param location string = resourceGroup().location',
        language: 'bicep',
      },
    ]);
    expect(renderableUpdate).toMatchObject({
      surfaceId: 'assistant-turn-5::msg-3',
      components: [
        {
          id: 'artifact-file',
          component: 'Text',
          text: '📄 infra/main.bicep is available in the workspace.',
          variant: 'body2',
        },
      ],
    });
    expect(renderableUpdate?.components).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ component: 'FileEditor' }),
    ]));
    expect('updateComponents' in storedUpdate && storedUpdate.updateComponents?.components[0]).toMatchObject({
      id: 'artifact-file',
      component: 'FileEditor',
      filename: 'infra/main.bicep',
      artifactPath: 'artifacts/infra/main.bicep',
      content: 'param location string = resourceGroup().location',
      language: 'bicep',
    });
  });

  it('leaves shared surfaces unscoped so later turns can update them in place', () => {
    const payload: A2uiPayloadItem[] = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'shared:triage-main', catalogId: 'kickstart' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'shared:triage-main',
          components: [{ id: 'decision', component: 'DecisionCard', title: 'Track', recommendation: 'Use AKS' }],
        },
      },
    ];

    const prepared = prepareChatA2ui(payload, 'assistant-turn-shared');

    expect(prepared.renderableMessages).toEqual([
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'shared:triage-main', catalogId: 'kickstart' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'shared:triage-main',
          components: [{ id: 'decision', component: 'DecisionCard', title: 'Track', recommendation: 'Use AKS' }],
        },
      },
    ]);
  });
});

describe('rebuildChatSessionState', () => {
  it('keeps repeated raw file surfaces isolated per assistant turn', () => {
    const restored = rebuildChatSessionState([
      {
        id: 'assistant-turn-6',
        a2uiMessages: [
          {
            version: 'v0.9',
            createSurface: { surfaceId: 'msg-duplicate', catalogId: 'kickstart' },
          },
          {
            version: 'v0.9',
            updateComponents: {
              surfaceId: 'msg-duplicate',
              components: [
                {
                  id: 'file-one',
                  component: 'FileEditor',
                  filename: 'src/index.ts',
                  language: 'typescript',
                  content: 'console.log("one")',
                },
              ],
            },
          },
        ],
      },
      {
        id: 'assistant-turn-7',
        a2uiMessages: [
          {
            version: 'v0.9',
            createSurface: { surfaceId: 'msg-duplicate', catalogId: 'kickstart' },
          },
          {
            version: 'v0.9',
            updateComponents: {
              surfaceId: 'msg-duplicate',
              components: [
                {
                  id: 'file-two',
                  component: 'FileEditor',
                  filename: 'Dockerfile',
                  language: 'dockerfile',
                  content: 'FROM node:20-alpine',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(restored.files).toEqual([
      {
        path: 'src/index.ts',
        content: 'console.log("one")',
        language: 'typescript',
      },
      {
        path: 'Dockerfile',
        content: 'FROM node:20-alpine',
        language: 'dockerfile',
      },
    ]);
    expect(restored.renderableMessages.map((message) =>
      message.createSurface?.surfaceId
      ?? message.updateComponents?.surfaceId
      ?? message.updateDataModel?.surfaceId
      ?? message.deleteSurface?.surfaceId
      ?? null,
    )).toEqual([
      'assistant-turn-6::msg-duplicate',
      'assistant-turn-6::msg-duplicate',
      'assistant-turn-7::msg-duplicate',
      'assistant-turn-7::msg-duplicate',
    ]);
    expect(restored.renderableMessages[1].updateComponents?.components).toEqual([
      {
        id: 'file-one',
        component: 'Text',
        text: '📄 src/index.ts is available in the workspace.',
        variant: 'body2',
      },
    ]);
    expect(restored.renderableMessages[3].updateComponents?.components).toEqual([
      {
        id: 'file-two',
        component: 'Text',
        text: '📄 Dockerfile is available in the workspace.',
        variant: 'body2',
      },
      ]);
  });

  it('reuses the same shared surface id across assistant turns during replay', () => {
    const restored = rebuildChatSessionState([
      {
        id: 'assistant-turn-11',
        a2uiMessages: [
          {
            version: 'v0.9',
            createSurface: { surfaceId: 'shared:triage-main', catalogId: 'kickstart' },
          },
          {
            version: 'v0.9',
            updateComponents: {
              surfaceId: 'shared:triage-main',
              components: [{ id: 'decision', component: 'DecisionCard', title: 'Track', recommendation: 'Use AKS' }],
            },
          },
        ],
      },
      {
        id: 'assistant-turn-12',
        a2uiMessages: [
          {
            version: 'v0.9',
            createSurface: { surfaceId: 'shared:triage-main', catalogId: 'kickstart' },
          },
          {
            version: 'v0.9',
            updateComponents: {
              surfaceId: 'shared:triage-main',
              components: [{
                id: 'inference',
                component: 'RadioGroup',
                options: [{ id: 'foundry', label: 'Azure AI Foundry' }],
                action: { event: { name: 'select_inference' } },
              }],
            },
          },
        ],
      },
    ]);

    expect(restored.renderableMessages.map((message) =>
      message.createSurface?.surfaceId
      ?? message.updateComponents?.surfaceId
      ?? null,
    )).toEqual([
      'shared:triage-main',
      'shared:triage-main',
      'shared:triage-main',
      'shared:triage-main',
    ]);
  });
});

describe('prepareStepwiseSetup', () => {
  const stepwiseEvents: SetupGenerationEvent[] = [
    {
      type: 'step_start',
      stepId: 'dockerfile',
      label: 'Dockerfile',
      sequence: 1,
    },
    {
      type: 'file_generated',
      stepId: 'dockerfile',
      path: 'Dockerfile',
      language: 'dockerfile',
      content: 'FROM node:20-alpine',
      byteLength: 19,
      sha256: 'sha-dockerfile',
    },
    {
      type: 'step_complete',
      stepId: 'dockerfile',
      filesCount: 1,
      totalBytes: 19,
    },
  ];

  it('uses file_generated content for live workspace writes while keeping chat progress-only', () => {
    const prepared = prepareStepwiseSetup(stepwiseEvents, 'assistant-turn-stepwise', {
      final: false,
    });

    expect(prepared.phase).toBe('generate');
    expect(prepared.statusText).toBe('Dockerfile complete — 1 file added to the workspace.');
    expect(prepared.files).toEqual([
      {
        path: 'Dockerfile',
        content: 'FROM node:20-alpine',
        language: 'dockerfile',
      },
    ]);
    expect(prepared.renderableMessages).toEqual([
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'assistant-turn-stepwise::setup-progress',
          catalogId: 'kickstart',
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'assistant-turn-stepwise::setup-progress',
          components: [
            {
              id: 'setup-progress',
              component: 'GenerationProgress',
              title: GENERATION_PROGRESS_TITLE,
              overallStatus: 'running',
              statusMessage: 'Dockerfile complete — 1 file added to the workspace.',
              steps: [
                {
                  id: 'dockerfile',
                  label: 'Dockerfile',
                  status: 'complete',
                  detail: '1 file added • 19 B',
                },
              ],
            },
          ],
        },
      },
    ]);
  });

  it('replays persisted stepwise metadata without resurrecting files outside the workspace snapshot', () => {
    const persistedEvents = stepwiseEvents.map((event) => redactSetupEvent(event));
    const prepared = prepareStepwiseSetup(persistedEvents, 'assistant-turn-stepwise', {
      final: true,
    });

    expect(prepared.files).toEqual([]);
    expect(prepared.renderableMessages[1].updateComponents).toMatchObject({
      surfaceId: 'assistant-turn-stepwise::setup-progress',
      components: [
        {
          id: 'setup-progress',
          component: 'GenerationProgress',
          title: GENERATION_PROGRESS_TITLE,
          overallStatus: 'complete',
          statusMessage: 'Project setup complete. Generated files are ready in the workspace.',
          steps: [
            {
              id: 'dockerfile',
              label: 'Dockerfile',
              status: 'complete',
            },
          ],
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
            phases: [
              { id: 'review', label: 'Review', status: 'active' },
            ],
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
                phases: [
                  { id: 'validate', label: 'Validate', status: 'active' },
                ],
              },
            ],
          },
        },
      },
    ];

    expect(getLatestConversationPhase(messages)).toBe('review');
  });

  it('treats persisted stepwise setup events as generate phase progress', () => {
    const messages: ChatMessage[] = [
      {
        id: 'assistant-turn-8',
        role: 'assistant',
        text: 'Project setup is running.',
        timestamp: 0,
        setupEvents: [{
          type: 'step_start',
          stepId: 'dockerfile',
          label: 'Dockerfile',
          sequence: 1,
        }],
      },
    ];

    expect(getLatestConversationPhase(messages)).toBe('generate');
  });
});

describe('claimSurfaceOwnership', () => {
  const existingSurfaces = new Set(['shared:track-picker', 'shared:other', 'msg-1#0']);
  const surfaceExists = (id: string) => existingSurfaces.has(id);

  it('claims unowned surfaces for the current assistant message', () => {
    const surfaceOwners = new Map<string, string>();

    const result = claimSurfaceOwnership({
      candidateIds: ['shared:track-picker', 'msg-1#0'],
      assistantMessageId: 'assistant-1',
      alreadyTracked: new Set(),
      surfaceExists,
      surfaceOwners,
    });

    expect(result.ownedIds).toEqual(['shared:track-picker', 'msg-1#0']);
    expect(result.transferredFromMessageIds.size).toBe(0);
    expect(surfaceOwners.get('shared:track-picker')).toBe('assistant-1');
    expect(surfaceOwners.get('msg-1#0')).toBe('assistant-1');
  });

  it('skips surfaces that no longer exist in the processor', () => {
    const surfaceOwners = new Map<string, string>();

    const result = claimSurfaceOwnership({
      candidateIds: ['shared:missing'],
      assistantMessageId: 'assistant-1',
      alreadyTracked: new Set(),
      surfaceExists,
      surfaceOwners,
    });

    expect(result.ownedIds).toEqual([]);
    expect(surfaceOwners.size).toBe(0);
  });

  it('does not re-emit ids the streaming queue already tracks', () => {
    const surfaceOwners = new Map<string, string>([
      ['shared:track-picker', 'assistant-1'],
    ]);

    const result = claimSurfaceOwnership({
      candidateIds: ['shared:track-picker', 'shared:track-picker'],
      assistantMessageId: 'assistant-1',
      alreadyTracked: new Set(['shared:track-picker']),
      surfaceExists,
      surfaceOwners,
    });

    expect(result.ownedIds).toEqual([]);
    expect(result.transferredFromMessageIds.size).toBe(0);
  });

  it('transfers ownership when a prior assistant message owned the surface', () => {
    const surfaceOwners = new Map<string, string>([
      ['shared:track-picker', 'assistant-1'],
    ]);

    const result = claimSurfaceOwnership({
      candidateIds: ['shared:track-picker'],
      assistantMessageId: 'assistant-2',
      alreadyTracked: new Set(),
      surfaceExists,
      surfaceOwners,
    });

    expect(result.ownedIds).toEqual(['shared:track-picker']);
    expect(result.transferredFromMessageIds.get('shared:track-picker')).toBe('assistant-1');
    expect(surfaceOwners.get('shared:track-picker')).toBe('assistant-2');
  });

  it('deduplicates repeated candidate ids within a single call', () => {
    const surfaceOwners = new Map<string, string>();

    const result = claimSurfaceOwnership({
      candidateIds: ['shared:other', 'shared:other'],
      assistantMessageId: 'assistant-1',
      alreadyTracked: new Set(),
      surfaceExists,
      surfaceOwners,
    });

    expect(result.ownedIds).toEqual(['shared:other']);
  });
});
