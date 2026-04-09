import React from 'react';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';
import type { ChatMessage as ChatMessageType } from '../../types';
import type { SurfaceModel } from '../../vendor/a2ui/web_core/index';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';

interface MessageListProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
  streamingText: string;
  getSurface: (id: string) => SurfaceModel<ReactComponentImplementation> | undefined;
}

export function MessageList({ messages, isStreaming, streamingText, getSurface }: MessageListProps) {
  const lastIndex = messages.length - 1;
  return (
    <>
      {messages.map((msg, index) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          getSurface={getSurface}
          isActive={index === lastIndex}
        />
      ))}

      {/* Streaming message (being generated) */}
      {isStreaming && streamingText && (
        <div className="chat-bubble assistant streaming">
          <span className="streaming-text">{streamingText}</span>
          <span className="streaming-cursor" />
        </div>
      )}

      {/* Typing indicator when waiting for first token */}
      {isStreaming && !streamingText && (
        <TypingIndicator />
      )}
    </>
  );
}
