import React from 'react';
import { A2UISurfaceWrapper } from '../A2UI/A2UISurfaceWrapper';
import type { ChatMessage as ChatMessageType } from '../../types';
import type { SurfaceModel } from '../../vendor/a2ui/web_core/index';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';

interface ChatMessageProps {
  message: ChatMessageType;
  getSurface: (id: string) => SurfaceModel<ReactComponentImplementation> | undefined;
}

export function ChatMessage({ message, getSurface }: ChatMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="chat-bubble user">
        {message.text}
      </div>
    );
  }

  // Assistant message
  return (
    <div className="chat-bubble assistant">
      {/* Render text with basic markdown-like formatting */}
      {message.text && (
        <div dangerouslySetInnerHTML={{ __html: formatText(message.text) }} />
      )}

      {/* Render A2UI surfaces inline */}
      {message.surfaceIds?.map(surfaceId => {
        const surface = getSurface(surfaceId);
        if (!surface) return null;
        return (
          <div key={surfaceId} className="a2ui-component">
            <A2UISurfaceWrapper surface={surface} />
          </div>
        );
      })}

      {/* Model indicator */}
      {message.model && (
        <span className="model-indicator">{message.model}</span>
      )}
    </div>
  );
}

function formatText(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Newlines to paragraphs
    .split('\n\n')
    .map(p => `<p>${p.trim()}</p>`)
    .join('')
    // Single newlines to <br> within paragraphs
    .replace(/(?<!<\/?p>)\n/g, '<br>');
}
