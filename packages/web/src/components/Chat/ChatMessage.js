import React from 'react';
import { BotSparkle24Regular } from '@fluentui/react-icons';
import { A2UISurfaceWrapper } from '../A2UI/A2UISurfaceWrapper';
import { sanitizeHtml } from '../../utils/sanitize';
export function ChatMessage({ message, getSurface, isActive = true }) {
    if (message.role === 'user') {
        if (message.isAutoContinue) {
            return (<div className="chat-bubble auto-continue">
          <span className="auto-continue-label">Continuing...</span>
        </div>);
        }
        return (<div className="chat-bubble user">
        {message.text}
      </div>);
    }
    // Assistant message
    return (<div className="chat-bubble-row">
      <BotSparkle24Regular className="assistant-avatar"/>
      <div className="chat-bubble assistant">
        {/* Render text with basic markdown-like formatting */}
        {message.text && (<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatText(message.text)) }}/>)}

        {/* Render A2UI surfaces inline */}
        {message.surfaceIds?.map(surfaceId => {
            const surface = getSurface(surfaceId);
            if (!surface)
                return null;
            return (<div key={surfaceId} className="a2ui-component">
              <A2UISurfaceWrapper surface={surface} isActive={isActive}/>
            </div>);
        })}

        {/* Model indicator */}
        {message.model && (<span className="model-indicator">{message.model}</span>)}
      </div>
    </div>);
}
function formatText(text) {
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
//# sourceMappingURL=ChatMessage.js.map