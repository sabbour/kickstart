import { randomUUID } from 'node:crypto';
import type { A2UIMessageV09 as A2UIMessage } from '../types/a2ui.js';
import type { Artifact, A2UICatalog, SessionCtx, Turn, PendingUserAction, AppIntent, AzureCredential } from '../types/session.js';
import type { Phase } from '../index.js';

export interface SessionData {
  sessionId: string;
  user: { oid: string; tid?: string; upn?: string };
  workspaceRoot: string;
  currentPhase: Phase;
  history: { role: 'user' | 'assistant'; content: string }[];
  a2uiEmissions: A2UIMessage[];
  pendingUserAction: PendingUserAction | null;
  createdAt: number;
  lastActiveAt: number;
}

const DEFAULT_CATALOG: A2UICatalog = { id: 'kickstart', components: [], userActions: [] };

export class Session implements SessionCtx {
  readonly sessionId: string;
  user: { oid: string; tid?: string; upn?: string };
  intent: AppIntent | null = null;
  artifacts: Map<string, Artifact> = new Map();
  a2uiEmissions: A2UIMessage[] = [];
  negotiatedCatalog: A2UICatalog = DEFAULT_CATALOG;
  recentTurns: Turn[] = [];
  activeAgent = 'core.triage';
  pendingUserAction: PendingUserAction | null = null;
  workspaceRoot: string;
  currentPhase: Phase;
  /** Leela BLOCK-1: real first-class field; no type-cast side-channel needed. */
  lastActiveAt: number = Date.now();

  constructor(opts: {
    sessionId: string;
    user: { oid: string; tid?: string; upn?: string };
    workspaceRoot?: string;
    currentPhase?: Phase;
  }) {
    this.sessionId = opts.sessionId;
    this.user = opts.user;
    this.workspaceRoot = opts.workspaceRoot ?? '/workspace';
    this.currentPhase = (opts.currentPhase ?? 'discover') as Phase;
  }

  recordA2UIEmission(msg: A2UIMessage): void {
    this.a2uiEmissions.push(msg);
  }

  recordArtifact(artifact: Artifact): void {
    this.artifacts.set(artifact.path, artifact);
  }

  recordTurn(turn: Turn): void {
    this.recentTurns.push(turn);
    // Keep a bounded sliding window of recent turns (last 50)
    if (this.recentTurns.length > 50) {
      this.recentTurns.splice(0, this.recentTurns.length - 50);
    }
  }

  async getAzureCreds(): Promise<AzureCredential> {
    // TODO(Step 7): Implement real Azure credential retrieval via pack-azure.
    return undefined;
  }

  async getGithubToken(): Promise<unknown> {
    // TODO(Step 9): Implement real GitHub token retrieval via pack-github.
    return undefined;
  }

  touch(): void {
    this.lastActiveAt = Date.now();
  }

  /** Drain all pending a2uiEmissions and clear the array, returning what was drained. */
  drainA2UIEmissions(): A2UIMessage[] {
    const drained = this.a2uiEmissions.splice(0);
    return drained;
  }
}

// ---------------------------------------------------------------------------
// In-memory session store
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

export const sessionStore = new Map<string, Session>();

// Cleanup stale sessions periodically
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessionStore) {
    if (now - session.lastActiveAt > SESSION_TTL_MS) {
      sessionStore.delete(id);
    }
  }
}, 5 * 60 * 1000);

// Allow the timer to not block process exit in serverless environments
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

export function getOrCreateSession(
  sessionId: string | undefined,
  oid: string,
  workspaceRoot = '/workspace',
): Session {
  const id = sessionId ?? randomUUID();
  let session = sessionStore.get(id);
  if (!session) {
    session = new Session({ sessionId: id, user: { oid }, workspaceRoot });
    sessionStore.set(id, session);
  } else if (session.user.oid !== oid) {
    // B1: Prevent cross-user session attachment
    throw new Error('SESSION_OID_MISMATCH');
  }
  // Update last-active time for TTL cleanup
  session.touch();
  return session;
}
