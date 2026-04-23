import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowRight24Regular } from '@fluentui/react-icons';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  statusBar?: React.ReactNode;
}

export function ChatInput({ onSend, disabled, statusBar }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-input-area">
      {statusBar}
      <div className="chat-input-inner">
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Describe what you want to build..."
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          title="Send"
        >
          <ArrowRight24Regular className="chat-send-icon" />
        </button>
      </div>
    </div>
  );
}
