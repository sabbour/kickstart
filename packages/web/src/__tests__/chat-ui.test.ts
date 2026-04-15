import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChatMessage as ChatMessageView } from '../components/Chat/ChatMessage';
import { ChatShell } from '../components/Chat/ChatShell';
import type { ChatMessage } from '../types';
import { GENERATE_PROGRESS_TITLE, getLatestConversationPhase, rebuildChatSessionState } from '../utils/chat-a2ui';

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

function renderChatShell(messages: ChatMessage[], currentPhase: string | null, debugEnabled = false): string {
  return renderToStaticMarkup(
    React.createElement(ChatShell, {
      messages,
      isStreaming: false,
      streamingText: '',
      currentPhase,
      onSend: () => undefined,
      getSurface: () => undefined,
      debugEnabled,
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
        model: 'gpt-5.3-chat',
        rawResponse: '{}',
      },
    });

    useStateSpy.mockRestore();

    expect(markup).not.toContain('deploy-now');
    expect(markup).not.toContain('Deploy now');
  });

  it('renders action events once in the separate chat-level debug log', () => {
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

    expect(markup).toContain('data-testid="chat-debug-action-log"');
    expect(markup).toContain('Action timeline (1)');
    expect(markup).toContain('deploy-now');
    expect(markup).toContain('Deploy now');
    expect((markup.match(/data-testid="chat-debug-action-log"/g) ?? []).length).toBe(1);
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
                  component: 'DeploymentProgress',
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
      title: GENERATE_PROGRESS_TITLE,
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
});
