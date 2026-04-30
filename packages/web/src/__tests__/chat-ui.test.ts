import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Fluent v9 components + icons go through internal context hooks that resolve
// `react` via commonjs and trip the "Cannot read properties of null" /
// "Invalid hook call" SSR errors under vitest's node env. Mock the surfaces
// used by the chat regression tests with passthrough HTML stubs; the
// assertions only care about surrounding markup and data-testids.
vi.mock('@fluentui/react-components', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@fluentui/react-components');
  const passthrough = (tag: string) =>
    ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) =>
      React.createElement(tag, rest as Record<string, unknown>, children);
  const stubs: Record<string, unknown> = { ...actual };
  // Override components/hooks that exercise Fluent context internals.
  // Fluent components are React.forwardRef (object) or functions — stub both
  // when the export name starts with a capital letter.
  for (const key of Object.keys(actual)) {
    const val = actual[key];
    if (/^[A-Z]/.test(key) && (typeof val === 'function' || typeof val === 'object')) {
      stubs[key] = passthrough('div');
    }
  }
  stubs.makeStyles = (styles: Record<string, unknown>) => () =>
    Object.fromEntries(Object.keys(styles).map((k) => [k, k])) as Record<string, string>;
  stubs.tokens = new Proxy({}, { get: () => '' });
  return stubs;
});

vi.mock('@fluentui/react-icons', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@fluentui/react-icons');
  const iconStub = () => React.createElement('span', { 'data-icon': true });
  const stubs: Record<string, unknown> = {};
  for (const key of Object.keys(actual)) {
    const val = actual[key];
    if (/^[A-Z]/.test(key) && (typeof val === 'function' || typeof val === 'object')) {
      stubs[key] = iconStub;
    } else {
      stubs[key] = val;
    }
  }
  return stubs;
});

const { ChatMessage: ChatMessageView } = await import('../components/Chat/ChatMessage');
const { ChatShell } = await import('../components/Chat/ChatShell');
const { DebugPanel } = await import('../components/Chat/DebugPanel');
import type { ChatMessage, TokenUsageSummary } from '../types';
import { GENERATION_PROGRESS_TITLE, getLatestConversationPhase, rebuildChatSessionState } from '../utils/chat-a2ui';
import { summarizeTokenUsage } from '../utils/chat-usage';
import { A2uiSurface } from '../vendor/a2ui/react';
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';
import { Catalog, MessageProcessor } from '../vendor/a2ui/web_core/index';
import { BASIC_FUNCTIONS } from '../vendor/a2ui/web_core/basic_catalog/index';
import { fluentOverrides } from '../catalog/fluent-components/index';
import type { A2uiMessage } from '../vendor/a2ui/web_core/schema/server-to-client';

const debugState = vi.hoisted(() => ({
  actionLog: [] as Array<{
    timestamp: number;
    actionName: string;
    category: string;
    context: Record<string, unknown>;
    outboundMessage: string;
  }>,
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('../contexts/DebugContext', () => ({
  useDebug: () => ({
    debugEnabled: true,
    toggleDebug: () => undefined,
    setDebugEnabled: () => undefined,
    actionLog: debugState.actionLog,
    logAction: () => undefined,
    clearActionLog: () => undefined,
  }),
}));

function renderChatMessage(message: ChatMessage, debugEnabled = true): string {
  return renderToStaticMarkup(
    React.createElement(ChatMessageView, {
      message,
      getSurface: () => undefined,
      debugEnabled,
    }),
  );
}

function renderChatShell(
  messages: ChatMessage[],
  currentPhase: string | null,
  debugEnabled = false,
  usageSummary?: TokenUsageSummary | null,
): string {
  return renderToStaticMarkup(
    React.createElement(ChatShell, {
      messages,
      isStreaming: false,
      streamingText: '',
      currentPhase,
      onSend: () => undefined,
      getSurface: () => undefined,
      debugEnabled,
      usageSummary,
    }),
  );
}

describe('chat/debug UI regressions', () => {
  it('renders the visible phase bar for a phase-indicator payload returned with assistant content', () => {
    const messages: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: '',
        timestamp: 1,
        a2uiMessages: [
          {
            type: 'ConversationPhase',
            id: 'phase-indicator',
            currentPhase: 'build',
            phases: [
              { id: 'discover', label: 'Discover', status: 'complete' },
              { id: 'build', label: 'Build', status: 'active' },
            ],
          },
        ],
      },
    ];

    const currentPhase = getLatestConversationPhase(messages);
    const markup = renderChatShell(messages, currentPhase);

    expect(currentPhase).toBe('generate');
    expect(markup).toContain('class="chat-phase"');
    expect(markup).toContain('aria-label="Current phase: Generate"');
    expect(markup).toContain('Discover');
    expect(markup).toContain('Design');
    expect(markup).toContain('Generate');
    expect(markup).toContain('Review');
    expect(markup).toContain('Handoff');
    expect(markup).toContain('Deploy');
  });

  it('does not render action events inline inside expanded assistant debug panels', () => {
    debugState.actionLog = [{
      timestamp: 1,
      actionName: 'deploy-now',
      category: 'submit',
      context: { step: 'deploy' },
      outboundMessage: 'Deploy now',
    }];

    const useStateSpy = vi.spyOn(React, 'useState');
    const mockSetExpanded: React.Dispatch<React.SetStateAction<unknown>> = () => undefined;
    useStateSpy.mockReturnValueOnce([true, mockSetExpanded] as ReturnType<typeof React.useState>);

    const markup = renderChatMessage({
      id: 'assistant-1',
      role: 'assistant',
      text: '',
      timestamp: 1,
      debugInfo: {
        model: 'gpt-5.4-mini',
        rawResponse: '{}',
      },
    });

    useStateSpy.mockRestore();

    expect(markup).not.toContain('deploy-now');
    expect(markup).not.toContain('Deploy now');
  });

  it('does not render an empty assistant bubble for a surface-only follow-up turn', () => {
    const markup = renderChatMessage({
      id: 'assistant-2',
      role: 'assistant',
      text: '',
    }, false);

    expect(markup).toBe('');
  });

  it('does not render the separate action timeline in chat shell debug mode', () => {
    debugState.actionLog = [{
      timestamp: 1,
      actionName: 'deploy-now',
      category: 'submit',
      context: { step: 'deploy' },
      outboundMessage: 'Deploy now',
    }];

    const markup = renderChatShell([
      {
        id: 'assistant-1',
        role: 'assistant',
        text: '',
        timestamp: 1,
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        text: '',
        timestamp: 2,
      },
    ], null, true);

    expect(markup).not.toContain('data-testid="chat-debug-action-log"');
    expect(markup).not.toContain('Action timeline');
    expect(markup).not.toContain('deploy-now');
    expect(markup).not.toContain('Deploy now');
  });

  it('shows the token tracker only while debug mode is enabled', () => {
    const messages: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: '',
        model: 'gpt-5.4-mini',
        timestamp: 1,
        usage: {
          model: 'gpt-5.4-mini',
          inputTokens: 120,
          outputTokens: 45,
          totalTokens: 165,
          recordedAt: '2026-04-15T00:00:00.000Z',
          estimatedCostUsd: 0.01,
          costStatus: 'estimated',
        },
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        text: '',
        model: 'gpt-5.4-mini',
        timestamp: 2,
        usage: {
          model: 'gpt-5.4-mini',
          inputTokens: 80,
          outputTokens: 30,
          totalTokens: 110,
          recordedAt: '2026-04-15T00:01:00.000Z',
          estimatedCostUsd: 0.02,
          costStatus: 'estimated',
        },
      },
    ];

    const usageSummary = summarizeTokenUsage(messages);
    const defaultMarkup = renderChatShell(messages, null, false, usageSummary);
    const debugMarkup = renderChatShell(messages, null, true, usageSummary);

    expect(usageSummary?.session).toMatchObject({
      inputTokens: 200,
      outputTokens: 75,
      totalTokens: 275,
      turnCount: 2,
      estimatedCostUsd: 0.03,
    });
    expect(defaultMarkup).not.toContain('data-testid="chat-usage-tracker"');
    expect(debugMarkup).toContain('data-testid="chat-usage-tracker"');
    expect(debugMarkup).toContain('▲ 80');
    expect(debugMarkup).toContain('▼ 30');
    expect(debugMarkup).toContain('Σ 200 / 75');
    expect(debugMarkup).toContain('~$0.03');
    expect(debugMarkup).toContain('gpt-5.4-mini');
  });

  it('renders a copy button in the expanded debug panel', () => {
    const useStateSpy = vi.spyOn(React, 'useState');
    const mockSetExpanded: React.Dispatch<React.SetStateAction<unknown>> = () => undefined;
    useStateSpy.mockReturnValueOnce([true, mockSetExpanded] as ReturnType<typeof React.useState>);

    const markup = renderToStaticMarkup(
      React.createElement(DebugPanel, {
        debugInfo: {
          model: 'gpt-5.4-mini',
          rawResponse: '{"message":"hello"}',
        },
      }),
    );

    useStateSpy.mockRestore();

    expect(markup).toContain('Copy response');
  });

  it('shows a warning for missing referenced components while debug mode is enabled', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const testCatalog = new Catalog<ReactComponentImplementation>(
      'test-catalog',
      fluentOverrides,
      BASIC_FUNCTIONS,
    );
    const processor = new MessageProcessor<ReactComponentImplementation>(
      [testCatalog],
      () => undefined,
    );

    const surfaceMessages: A2uiMessage[] = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'msg-1', catalogId: testCatalog.id },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'msg-1',
          components: [
            { id: 'root', component: 'Column', children: ['diagram'], gap: '12px' },
          ],
        },
      },
    ];

    processor.processMessages(surfaceMessages);

    const surface = processor.model.getSurface('msg-1');
    expect(surface).toBeDefined();

    const markup = renderToStaticMarkup(
      React.createElement(A2uiSurface, {
        surface: surface!,
      }),
    );

    expect(markup).toContain('Missing component: diagram');
    expect(warnSpy).toHaveBeenCalledWith(
      '[A2UI] Referenced component "diagram" is not available on surface "msg-1"',
    );

    warnSpy.mockRestore();
  });
});

describe('chat file workspace rehydration', () => {
  it('rebuilds the selected session workspace without leaking files across sessions', () => {
    const firstSession = rebuildChatSessionState([
      {
        id: 'assistant-turn-8',
        a2uiMessages: [
          {
            type: 'ConversationPhase' as const,
            id: 'phase-indicator',
            currentPhase: 'generate',
            phases: [
              { id: 'discover', label: 'Discover', status: 'complete' as const },
              { id: 'generate', label: 'Generate', status: 'active' as const },
            ],
          },
          {
            version: 'v0.9' as const,
            createSurface: { surfaceId: 'msg-1', catalogId: 'kickstart' },
          },
          {
            version: 'v0.9' as const,
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
                  artifactPath: 'artifacts/Dockerfile',
                },
              ],
            },
          },
        ],
      },
    ], {
      resolveArtifactContent: (artifactPath) => artifactPath === 'artifacts/Dockerfile'
        ? 'FROM node:20-alpine'
        : null,
    });

    expect(firstSession.files).toEqual([
      {
        path: 'artifacts/Dockerfile',
        content: 'FROM node:20-alpine',
        language: 'dockerfile',
      },
    ]);
    expect(firstSession.renderableMessages[0].createSurface?.surfaceId).toBe('assistant-turn-8::msg-1');
    expect(firstSession.renderableMessages[1].updateComponents?.surfaceId).toBe('assistant-turn-8::msg-1');
    expect(firstSession.renderableMessages[1].updateComponents?.components[0]).toMatchObject({
      id: 'progress',
      title: GENERATION_PROGRESS_TITLE,
    });

    const secondSession = rebuildChatSessionState([
      {
        id: 'assistant-turn-9',
        a2uiMessages: [
          {
            version: 'v0.9' as const,
            createSurface: { surfaceId: 'msg-2', catalogId: 'kickstart' },
          },
          {
            version: 'v0.9' as const,
            updateComponents: {
              surfaceId: 'msg-2',
              components: [
                {
                  id: 'file',
                  component: 'FileEditor',
                  filename: 'k8s/deployment.yaml',
                  language: 'yaml',
                  content: 'apiVersion: apps/v1',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(secondSession.files).toEqual([
      {
        path: 'k8s/deployment.yaml',
        content: 'apiVersion: apps/v1',
        language: 'yaml',
      },
    ]);
    expect(secondSession.renderableMessages[0].createSurface?.surfaceId).toBe('assistant-turn-9::msg-2');
    expect(secondSession.renderableMessages[1].updateComponents?.surfaceId).toBe('assistant-turn-9::msg-2');
  });

  it('restores stepwise setup progress from persisted stream metadata without replaying inline files', () => {
    const restored = rebuildChatSessionState([
      {
        id: 'assistant-turn-10',
        model: 'gpt-5.4-mini',
        phase: 'generate',
        setupEvents: [
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
            byteLength: 19,
            sha256: 'sha-dockerfile',
          },
          {
            type: 'step_complete',
            stepId: 'dockerfile',
            filesCount: 1,
            totalBytes: 19,
          },
        ],
      },
    ]);

    expect(restored.phase).toBe('generate');
    expect(restored.files).toEqual([]);
    expect(restored.renderableMessages).toEqual([
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'assistant-turn-10::setup-progress',
          catalogId: 'kickstart',
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'assistant-turn-10::setup-progress',
          components: [
            {
              id: 'root',
              component: 'GenerationProgress',
              title: GENERATION_PROGRESS_TITLE,
              overallStatus: 'complete',
              statusMessage: 'Project setup complete. Generated files are ready in the workspace.',
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
});
