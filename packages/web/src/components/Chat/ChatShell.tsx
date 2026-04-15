import React, { useRef, useEffect } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TokenUsageTracker } from './TokenUsageTracker';
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
  getSurface: (id: string) => SurfaceModel<ReactComponentImplementation> | undefined;
  debugEnabled?: boolean;
  usageSummary?: TokenUsageSummary | null;
}

export function ChatShell({ messages, isStreaming, streamingText, streamingSurfaceIds, currentPhase, onSend, getSurface, debugEnabled, usageSummary }: ChatShellProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, streamingSurfaceIds]);

  const activePhaseIndex = currentPhase ? CONVERSATION_PHASE_ORDER.indexOf(currentPhase as typeof CONVERSATION_PHASE_ORDER[number]) : -1;
  const showPhaseBar = Boolean(currentPhase) && activePhaseIndex !== -1;

  return (
    <div id="chat-ui" className="chat-container">
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
            debugEnabled={debugEnabled}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>
      <ChatInput
        onSend={onSend}
        disabled={isStreaming}
        statusBar={debugEnabled && usageSummary ? <TokenUsageTracker usage={usageSummary} /> : undefined}
      />
    </div>
  );
}
