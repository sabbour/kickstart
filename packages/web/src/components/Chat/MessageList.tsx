import React from 'react';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';
import { A2UISurfaceWrapper } from '../A2UI/A2UISurfaceWrapper';
import type { ChatMessage as ChatMessageType } from '../../types';
import type { SurfaceModel } from '../../vendor/a2ui/web_core/index';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';

interface MessageListProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
  streamingText: string;
  streamingSurfaceIds?: string[];
  getSurface: (id: string) => SurfaceModel<ReactComponentImplementation> | undefined;
  debugEnabled?: boolean;
}

export function MessageList({ messages, isStreaming, streamingText, streamingSurfaceIds, getSurface, debugEnabled }: MessageListProps) {
  const lastIndex = messages.length - 1;
  const hasStreamingSurfaces = (streamingSurfaceIds?.length ?? 0) > 0;

  return (
    <>
      {messages.map((msg, index) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          getSurface={getSurface}
          isActive={index === lastIndex}
          debugEnabled={debugEnabled}
        />
      ))}

      {/* Streaming message (being generated) — shows text and any components that arrive progressively */}
      {isStreaming && (streamingText || hasStreamingSurfaces) && (
        <div className="chat-bubble-row">
          <img
            src="/assets/icons/compute/aks-automatic.svg"
            alt=""
            className="assistant-avatar"
            width="28"
            height="28"
          />
          <div className="chat-bubble assistant streaming">
            {streamingText && (
              <>
                <span className="streaming-text">{streamingText}</span>
                <span className="streaming-cursor" />
              </>
            )}
            {streamingSurfaceIds?.map((surfaceId, index) => {
              const surface = getSurface(surfaceId);
              if (!surface) return null;
              return (
                <div
                  key={surfaceId}
                  className="a2ui-component a2ui-component--entering"
                  style={{ '--enter-index': index } as React.CSSProperties}
                >
                  <A2UISurfaceWrapper surface={surface} isActive={true} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Typing indicator when waiting for first token and no components yet */}
      {isStreaming && !streamingText && !hasStreamingSurfaces && (
        <TypingIndicator />
      )}
    </>
  );
}
