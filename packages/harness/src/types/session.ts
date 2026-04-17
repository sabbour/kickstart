import type { A2UIMessageV09 } from './a2ui.js';

export interface AppIntent {
  id?: string;
  summary?: string;
  [key: string]: unknown;
}

export interface Artifact {
  path: string;
  kind?: string;
  metadata?: Record<string, unknown>;
}

export interface A2UICatalog {
  id: string;
  components?: readonly string[];
  userActions?: readonly string[];
}

export interface Turn {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  timestamp?: string;
}

export interface PendingUserAction {
  name: string;
  runId?: string;
  resultSchema?: unknown;
  issuedAt?: string;
}

// TODO(Step 3): Replace with the real Azure Identity credential contract.
export type AzureCredential = unknown;

export interface SessionCtx {
  sessionId: string;
  user: {
    tid?: string;
    oid?: string;
    upn?: string;
  };
  intent: AppIntent | null;
  artifacts: Map<string, Artifact>;
  negotiatedCatalog: A2UICatalog;
  recentTurns: Turn[];
  activeAgent: string;
  pendingUserAction: PendingUserAction | null;
  recordA2UIEmission(msg: A2UIMessageV09): void;
  recordArtifact(artifact: Artifact): void;
  recordTurn(turn: Turn): void;
  getAzureCreds(): Promise<AzureCredential>;
  // TODO(Step 3): Replace with a typed token/result contract once resume/runtime wiring lands.
  getGithubToken(): Promise<unknown>;
}
