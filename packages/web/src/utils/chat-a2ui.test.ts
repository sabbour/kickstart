import { describe, expect, it } from 'vitest';
import type { ChatMessage, A2uiPayloadItem } from '../types';
import {
  applyGenerateStreamEvent,
  buildGenerateProgressMessages,
  GENERATE_PROGRESS_TITLE,
  GENERATE_PROGRESS_SURFACE_ID,
  finalizeGenerateProgressState,
  getLatestConversationPhase,
  interruptGenerateProgressState,
  prepareChatA2ui,
  prepareChatA2uiPayload,
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
  it('suppresses inline FileEditor components during generate while still extracting workspace files', () => {
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

  it('turns stepwise generate events into progress-only chat surfaces while writing files to the workspace', () => {
    const started = applyGenerateStreamEvent(null, {
      type: 'step_start',
      stepId: 'dockerfile',
      label: 'Dockerfile',
      sequence: 1,
    }, { includeCreateSurface: true });
    const withFile = applyGenerateStreamEvent(started.state, {
      type: 'file_generated',
      stepId: 'dockerfile',
      path: 'Dockerfile',
      language: 'dockerfile',
      content: 'FROM node:20-alpine',
      byteLength: 19,
      sha256: 'sha-1',
    });
    const completed = applyGenerateStreamEvent(withFile.state, {
      type: 'step_complete',
      stepId: 'dockerfile',
      filesCount: 1,
      totalBytes: 19,
    });
    const finalized = finalizeGenerateProgressState(completed.state);

    const prepared = prepareChatA2ui(
      [
        ...started.messages,
        ...withFile.messages,
        ...completed.messages,
        ...buildGenerateProgressMessages(finalized, false),
      ],
      'assistant-turn-stepwise',
      { currentPhase: 'generate' },
    );

    expect(prepared.files).toEqual([
      {
        path: 'Dockerfile',
        content: 'FROM node:20-alpine',
        language: 'dockerfile',
      },
    ]);
    expect(prepared.renderableMessages[0].createSurface?.surfaceId).toBe(
      `assistant-turn-stepwise::${GENERATE_PROGRESS_SURFACE_ID}`,
    );
    expect(prepared.renderableMessages.slice(1)).toEqual([
      expect.objectContaining({
        updateComponents: expect.objectContaining({
          surfaceId: `assistant-turn-stepwise::${GENERATE_PROGRESS_SURFACE_ID}`,
          components: [
            expect.objectContaining({
              component: 'DeploymentProgress',
              title: GENERATE_PROGRESS_TITLE,
              overallStatus: 'running',
              statusMessage: 'Generating Dockerfile…',
            }),
          ],
        }),
      }),
      expect.objectContaining({
        updateComponents: expect.objectContaining({
          surfaceId: `assistant-turn-stepwise::${GENERATE_PROGRESS_SURFACE_ID}`,
          components: [
            expect.objectContaining({
              component: 'DeploymentProgress',
              statusMessage: 'Dockerfile added to workspace.',
            }),
          ],
        }),
      }),
      expect.objectContaining({
        updateComponents: expect.objectContaining({
          surfaceId: `assistant-turn-stepwise::${GENERATE_PROGRESS_SURFACE_ID}`,
          components: [
            expect.objectContaining({
              component: 'DeploymentProgress',
              overallStatus: 'running',
              statusMessage: 'Dockerfile complete.',
            }),
          ],
        }),
      }),
      expect.objectContaining({
        updateComponents: expect.objectContaining({
          surfaceId: `assistant-turn-stepwise::${GENERATE_PROGRESS_SURFACE_ID}`,
          components: [
            expect.objectContaining({
              component: 'DeploymentProgress',
              overallStatus: 'complete',
              statusMessage: 'Setup files are ready in the workspace.',
            }),
          ],
        }),
      }),
    ]);
    expect(
      prepared.renderableMessages.flatMap((message) => message.updateComponents?.components ?? []),
    ).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ component: 'FileEditor' }),
      expect.objectContaining({ component: 'Text', text: expect.stringContaining('workspace') }),
    ]));
  });

  it('marks interrupted stepwise progress as an error state without changing prior files', () => {
    const started = applyGenerateStreamEvent(null, {
      type: 'step_start',
      stepId: 'deployment-config',
      label: 'Deployment config',
      sequence: 2,
    });

    const interrupted = interruptGenerateProgressState(started.state, 'Connection interrupted.');

    expect(interrupted).toMatchObject({
      overallStatus: 'error',
      errorCode: 'connection_interrupted',
      errorMessage: 'Connection interrupted.',
      statusMessage: 'Connection interrupted.',
      steps: [
        {
          id: 'deployment-config',
          label: 'Deployment config',
          status: 'error',
          detail: 'Connection interrupted.',
        },
      ],
    });
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
});
