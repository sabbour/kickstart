import React from 'react';
export const MessageTextContext = React.createContext<string>('');
export function useMessageText(): string {
  return React.useContext(MessageTextContext);
}
