import React, { useRef, useEffect } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import type { ChatMessage } from '../../types';
import type { SurfaceModel } from '../../vendor/a2ui/web_core/index';
import type { A2uiClientAction } from '../../vendor/a2ui/web_core/schema/client-to-server';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';

const PHASE_LABELS: Record<string, string> = {
  discover: 'Discover',
  plan: 'Plan',
  build: 'Build',
  deploy: 'Deploy',
  validate: 'Validate',
};

const PHASE_ORDER = ['discover', 'plan', 'build', 'deploy', 'validate'];

interface ChatShellProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  streamingSurfaceIds?: string[];
  currentPhase?: string | null;
  onSend: (text: string) => void;
  getSurface: (id: string) => SurfaceModel<ReactComponentImplementation> | undefined;
  onAction?: (action: A2uiClientAction) => void | Promise<void>;
  debugEnabled?: boolean;
}

export function ChatShell({ messages, isStreaming, streamingText, streamingSurfaceIds, currentPhase, onSend, getSurface, onAction, debugEnabled }: ChatShellProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, streamingSurfaceIds]);

  const activePhaseIndex = currentPhase ? PHASE_ORDER.indexOf(currentPhase) : -1;

  return (
    <div id="chat-ui" className="chat-container">
      {currentPhase && (
        <div className="chat-phase" role="status" aria-label={`Current phase: ${PHASE_LABELS[currentPhase] || currentPhase}`}>
          {PHASE_ORDER.map((phase, index) => (
            <React.Fragment key={phase}>
              {index > 0 && (
                <span className={`chat-phase-connector${index <= activePhaseIndex ? ' completed' : ''}`} />
              )}
              <span className="chat-phase-step">
                <span className={`chat-phase-dot${index === activePhaseIndex ? ' active' : ''}${index < activePhaseIndex ? ' completed' : ''}`} />
                <span>{PHASE_LABELS[phase]}</span>
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
            onAction={onAction}
            debugEnabled={debugEnabled}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>
      <ChatInput onSend={onSend} disabled={isStreaming} />
    </div>
  );
}
