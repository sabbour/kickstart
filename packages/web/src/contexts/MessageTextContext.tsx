import { createContext, useContext } from 'react';

/**
 * Provides the surrounding assistant message text to descendant A2UI
 * components so they can derive best-guess defaults (e.g. ChoicePicker
 * auto-selection).  Value is empty string when no text is available.
 */
const MessageTextContext = createContext<string>('');

export const MessageTextProvider = MessageTextContext.Provider;

export function useMessageText(): string {
  return useContext(MessageTextContext);
}
