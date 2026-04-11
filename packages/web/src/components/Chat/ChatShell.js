import React, { useRef, useEffect } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
export function ChatShell({ messages, isStreaming, streamingText, streamingSurfaceIds, onSend, getSurface }) {
    const messagesEndRef = useRef(null);
    // Auto-scroll to bottom on new messages or streaming updates
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingText]);
    return (<div id="chat-ui" className="chat-container">
      <div className="chat-messages">
        <div className="chat-messages-inner">
          <MessageList messages={messages} isStreaming={isStreaming} streamingText={streamingText} streamingSurfaceIds={streamingSurfaceIds} getSurface={getSurface}/>
          <div ref={messagesEndRef}/>
        </div>
      </div>
      <ChatInput onSend={onSend} disabled={isStreaming}/>
    </div>);
}
//# sourceMappingURL=ChatShell.js.map