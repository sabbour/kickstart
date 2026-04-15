import React, { createContext, useContext, type ReactNode } from 'react';
import type { ConversationPhaseId, Session } from '../types';

export interface DeploymentSourceFile {
  path: string;
  content: string;
  language?: string;
}

interface ConversationSessionContextValue {
  localSessionId: string | null;
  backendSessionId: string | null;
  currentPhase: ConversationPhaseId | null;
  activeSession?: Session;
  getDeploymentFiles: () => Promise<DeploymentSourceFile[]>;
}

const ConversationSessionContext = createContext<ConversationSessionContextValue | null>(null);

export function ConversationSessionProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: ConversationSessionContextValue;
}) {
  return (
    <ConversationSessionContext.Provider value={value}>
      {children}
    </ConversationSessionContext.Provider>
  );
}

export function useConversationSession(): ConversationSessionContextValue {
  const ctx = useContext(ConversationSessionContext);
  if (!ctx) {
    throw new Error('useConversationSession must be used within a ConversationSessionProvider');
  }
  return ctx;
}
