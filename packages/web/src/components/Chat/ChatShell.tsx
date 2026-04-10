import React, { useRef, useEffect } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import type { ChatMessage } from '../../types';
import type { SurfaceModel } from '../../vendor/a2ui/web_core/index';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';

interface ChatShellProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  streamingSurfaceIds?: string[];
  onSend: (text: string) => void;
  getSurface: (id: string) => SurfaceModel<ReactComponentImplementation> | undefined;
}

export function ChatShell({ messages, isStreaming, streamingText, streamingSurfaceIds, onSend, getSurface }: ChatShellProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  return (
    <div id="chat-ui" className="chat-container">
      <div className="chat-messages">
        <div className="chat-messages-inner">
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            streamingText={streamingText}
            streamingSurfaceIds={streamingSurfaceIds}
            getSurface={getSurface}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>
      <ChatInput onSend={onSend} disabled={isStreaming} />
    </div>
  );
}
