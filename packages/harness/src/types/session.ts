import type { A2UIMessageV09 as A2UIMessage } from './a2ui.js';

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
  a2uiEmissions: A2UIMessage[];
  /**
   * Live surface IDs known to have an outstanding `createSurface` within this
   * session. Used by `core.emit_ui` to enforce idempotent surface lifecycle
   * (D11, #1075): reject duplicate `createSurface` and reject
   * `updateComponents` / `updateDataModel` / `deleteSurface` targeting a
   * surface that has not been created. Transient; not persisted across
   * session restart. Bounded by `maxLiveSurfaces`.
   */
  liveSurfaceIds: Set<string>;
  /**
   * Upper bound on `liveSurfaceIds.size`. Resolved once at harness module
   * load from `KICKSTART_MAX_LIVE_SURFACES` (default 1000, clamped
   * [10, 100000]). Enforced in `core.emit_ui` on `createSurface` to guard
   * against runaway in-memory growth (Zapp M1, #1075).
   */
  readonly maxLiveSurfaces: number;
  negotiatedCatalog: A2UICatalog;
  recentTurns: Turn[];
  activeAgent: string;
  pendingUserAction: PendingUserAction | null;
  /**
   * Per-turn record of skills pulled by `core.read_skill`. Reset at the top
   * of every `Runner.run` turn inside a try/finally. See `SkillTrackingCtx`
   * in `pack-core/src/tools/read_skill.ts` for the narrow consumer view.
   * Optional on the interface so unrelated consumers need not populate it.
   */
  skillsPulled?: Set<string>;
  skillsPulledBytes?: number;
  skillsPulledTokens?: number;
  recordA2UIEmission(msg: A2UIMessage): void;
  recordArtifact(artifact: Artifact): void;
  recordTurn(turn: Turn): void;
  getAzureCreds(): Promise<AzureCredential>;
  // TODO(Step 3): Replace with a typed token/result contract once resume/runtime wiring lands.
  getGithubToken(): Promise<unknown>;
}
