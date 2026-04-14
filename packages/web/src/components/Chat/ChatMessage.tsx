import React from 'react';
import { BotSparkle24Regular } from '@fluentui/react-icons';
import { A2UISurfaceWrapper } from '../A2UI/A2UISurfaceWrapper';
import { DebugPanel } from './DebugPanel';
import { MessageTextProvider } from '../../contexts/MessageTextContext';
import { sanitizeHtml } from '../../utils/sanitize';
import type { ChatMessage as ChatMessageType } from '../../types';
import type { SurfaceModel } from '../../vendor/a2ui/web_core/index';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';

interface ChatMessageProps {
  message: ChatMessageType;
  getSurface: (id: string) => SurfaceModel<ReactComponentImplementation> | undefined;
  isActive?: boolean;
  debugEnabled?: boolean;
}

export function ChatMessage({ message, getSurface, isActive = true, debugEnabled = false }: ChatMessageProps) {
  if (message.role === 'user') {
    if (message.isAutoContinue) {
      return (
        <div className="chat-bubble auto-continue">
          <span className="auto-continue-label">Continuing...</span>
        </div>
      );
    }
    return (
      <div className="chat-bubble user">
        {message.text}
      </div>
    );
  }

  // Assistant message
  return (
    <div className="chat-bubble-row">
      <BotSparkle24Regular className="assistant-avatar" />
      <div className="chat-bubble assistant">
        {message.phase && (
          <span className="chat-message-phase-badge">{message.phase}</span>
        )}
        {/* Render text with basic markdown-like formatting */}
        {message.text && (
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatText(message.text)) }} />
        )}

        {/* Provide assistant message text to A2UI components for best-guess auto-selection */}
        <MessageTextProvider value={message.text || ''}>
          {/* Render A2UI surfaces inline */}
          {message.surfaceIds?.map(surfaceId => {
            const surface = getSurface(surfaceId);
            if (!surface) return null;
            return (
              <div key={surfaceId} className="a2ui-component">
                <A2UISurfaceWrapper surface={surface} isActive={isActive} />
              </div>
            );
          })}
        </MessageTextProvider>

        {/* Debug panel — shown only when debug mode is active */}
        {debugEnabled && <DebugPanel debugInfo={message.debugInfo} surfaceIds={message.surfaceIds} />}
      </div>
    </div>
  );
}

function formatText(text: string): string {
  return text
    // URLs — strict http/https allowlist, reject javascript:/data:/malformed
    .replace(/(https?:\/\/[^\s<>")\]]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Newlines to paragraphs
    .split('\n\n')
    .map(p => `<p>${p.trim()}</p>`)
    .join('')
    // Single newlines to <br> within paragraphs
    .replace(/(?<!<\/?p>)\n/g, '<br>');
}
