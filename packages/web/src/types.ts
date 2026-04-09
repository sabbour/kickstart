// Shared TypeScript types for the Kickstart chat application

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  surfaceIds?: string[];
  phase?: string;
  model?: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  backendSessionId?: string;
}

export type AppMode = 'landing' | 'chat';

export interface DemoResponse {
  text: string;
  a2uiMessages: A2uiMsg[];
  phase: string;
  model?: string;
  typingDelay?: number;
}

export interface A2uiMsg {
  version: 'v0.9';
  createSurface?: {
    surfaceId: string;
    catalogId: string;
  };
  updateComponents?: {
    surfaceId: string;
    components: A2uiComponent[];
  };
  deleteSurface?: {
    surfaceId: string;
  };
  updateDataModel?: {
    surfaceId: string;
    path: string;
    value: unknown;
  };
}

export interface A2uiComponent {
  id: string;
  component: string;
  [key: string]: unknown;
}

export interface StreamEvent {
  delta?: string;
  content?: string;
  a2ui?: A2uiMsg[];
  phase?: string;
  model?: string;
  sessionId?: string;
}
