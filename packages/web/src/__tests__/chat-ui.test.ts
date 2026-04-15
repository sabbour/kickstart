import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChatMessage as ChatMessageView } from '../components/Chat/ChatMessage';
import { ChatShell } from '../components/Chat/ChatShell';
import type { ChatMessage } from '../types';
import { getLatestConversationPhase } from '../utils/chat-a2ui';

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
    useStateSpy.mockImplementationOnce(((_initial: boolean) => [true, () => undefined]) as typeof React.useState);

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
