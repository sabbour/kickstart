import React, { useRef, useEffect } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TokenUsageTracker } from './TokenUsageTracker';
import { DebugTraceExport } from './DebugTraceExport';
import type { ChatMessage, TokenUsageSummary } from '../../types';
import type { SurfaceModel } from '../../vendor/a2ui/web_core/index';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';
import { CONVERSATION_PHASE_LABELS, CONVERSATION_PHASE_ORDER } from '../../utils/chat-a2ui';

interface ChatShellProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  streamingSurfaceIds?: string[];
  currentPhase?: string | null;
  onSend: (text: string) => void;
  onRetryMessage?: (message: ChatMessage) => void;
  getSurface: (id: string) => SurfaceModel<ReactComponentImplementation> | undefined;
  getSurfaceRenderKey: (id: string) => string;
  debugEnabled?: boolean;
  usageSummary?: TokenUsageSummary | null;
  hasStartedConversation?: boolean;
  sessionId?: string;
}

export function ChatShell({
  messages,
  isStreaming,
  streamingText,
  streamingSurfaceIds,
  currentPhase,
  onSend,
  onRetryMessage,
  getSurface,
  getSurfaceRenderKey,
  debugEnabled,
  usageSummary,
  hasStartedConversation: hasStartedConversationOverride,
  sessionId,
}: ChatShellProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, streamingSurfaceIds]);

  const activePhaseIndex = currentPhase ? CONVERSATION_PHASE_ORDER.indexOf(currentPhase as typeof CONVERSATION_PHASE_ORDER[number]) : -1;
  const showPhaseBar = Boolean(currentPhase) && activePhaseIndex !== -1;
  const hasStartedConversation = hasStartedConversationOverride
    ?? (messages.length > 0 || Boolean(streamingText) || Boolean(streamingSurfaceIds?.length));
  const inputPlaceholder = hasStartedConversation ? 'Type a message...' : 'Describe what you want to build...';

  return (
    <div
      id="chat-ui"
      className="chat-container"
      data-streaming={isStreaming ? 'active' : 'idle'}
      aria-busy={isStreaming || undefined}
    >
      {showPhaseBar && (
        <div className="chat-phase" role="status" aria-label={`Current phase: ${CONVERSATION_PHASE_LABELS[currentPhase as keyof typeof CONVERSATION_PHASE_LABELS] || currentPhase}`}>
          {CONVERSATION_PHASE_ORDER.map((phase, index) => (
            <React.Fragment key={phase}>
              {index > 0 && (
                <span className={`chat-phase-connector${index <= activePhaseIndex ? ' completed' : ''}`} />
              )}
              <span className="chat-phase-step">
                <span className={`chat-phase-dot${index === activePhaseIndex ? ' active' : ''}${index < activePhaseIndex ? ' completed' : ''}`} />
                <span>{CONVERSATION_PHASE_LABELS[phase]}</span>
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
      <div className="chat-messages">
        <div className="chat-messages-inner">
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            streamingText={streamingText}
            streamingSurfaceIds={streamingSurfaceIds}
            getSurface={getSurface}
            getSurfaceRenderKey={getSurfaceRenderKey}
            debugEnabled={debugEnabled}
            onRetryMessage={onRetryMessage}
          />
          <div ref={messagesEndRef} />
          {debugEnabled && !isStreaming && messages.length > 0 && (
            <DebugTraceExport messages={messages} sessionId={sessionId} />
          )}
        </div>
      </div>
      <ChatInput
        onSend={onSend}
        disabled={isStreaming}
        placeholder={inputPlaceholder}
        statusBar={debugEnabled && usageSummary ? <TokenUsageTracker usage={usageSummary} /> : undefined}
      />
    </div>
  );
}
