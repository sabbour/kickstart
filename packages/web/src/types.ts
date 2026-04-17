/**
 * Web-client view-model types.
 *
 * These describe how the browser renders chat, A2UI surfaces, sessions, and
 * connector-backed forms. They are deliberately separate from the harness
 * runtime types in `@kickstart/harness` — the harness is domain-agnostic,
 * whereas this file carries the Kickstart product's browser vocabulary.
 */

import type { A2UIVersion } from '@kickstart/harness';

// ─────────────────────────────────────────────────────────────────────────────
// A2UI v0.9 client renderer types
// ─────────────────────────────────────────────────────────────────────────────

/** A single A2UI component descriptor (opaque to the harness). */
export interface A2uiComponent {
  id: string;
  component: string;
  [key: string]: unknown;
}

/** A2UI v0.9 surface mutation envelope — what the client renderer consumes. */
export interface A2uiMsg {
  version: A2UIVersion;
  createSurface?: {
    surfaceId: string;
    catalogId: string;
    theme?: unknown;
    sendDataModel?: boolean;
  };
  updateComponents?: {
    surfaceId: string;
    components: A2uiComponent[];
  };
  updateDataModel?: {
    surfaceId: string;
    path?: string;
    value?: unknown;
  };
  deleteSurface?: {
    surfaceId: string;
  };
}

/** Legacy ConversationPhase descriptor occasionally interleaved in the stream. */
export interface ConversationPhaseItem {
  type: 'ConversationPhase';
  id: string;
  currentPhase?: string;
  phases?: Array<{ id: string; label: string; status: string }>;
}

/** Anything the server may emit inside the `a2ui` payload array. */
export type A2uiPayloadItem = A2uiMsg | ConversationPhaseItem;

// ─────────────────────────────────────────────────────────────────────────────
// Conversation phases (client-facing labels)
// ─────────────────────────────────────────────────────────────────────────────

export type ConversationPhaseId =
  | 'discover'
  | 'design'
  | 'generate'
  | 'review'
  | 'handoff'
  | 'deploy';

// ─────────────────────────────────────────────────────────────────────────────
// Setup/generation events (streamed during file authoring)
// ─────────────────────────────────────────────────────────────────────────────

export type SetupGenerationEvent =
  | {
      type: 'step_start';
      stepId: string;
      label: string;
      sequence: number;
    }
  | {
      type: 'file_generated';
      stepId: string;
      path: string;
      language?: string;
      content?: string;
      byteLength: number;
      sha256: string;
    }
  | {
      type: 'step_complete';
      stepId: string;
      filesCount: number;
      totalBytes: number;
    }
  | {
      type: 'step_error';
      stepId: string;
      code: string;
      message: string;
      recoverable: boolean;
    };

// ─────────────────────────────────────────────────────────────────────────────
// Token usage (debug panel + TokenUsageTracker)
// ─────────────────────────────────────────────────────────────────────────────

export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
  estimatedCostUsd?: number;
  costStatus: 'estimated' | 'unavailable';
  recordedAt?: string;
}

export interface SessionUsageTotals {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  turnCount: number;
  estimatedCostUsd?: number;
  costStatus: 'estimated' | 'unavailable';
}

export interface TokenUsageSummary {
  turn: TurnUsage;
  session: SessionUsageTotals;
}

// ─────────────────────────────────────────────────────────────────────────────
// Debug metadata (visible when Ctrl+Shift+D toggles debug mode)
// ─────────────────────────────────────────────────────────────────────────────

export interface DebugMetadata {
  model?: string;
  systemPrompt?: string;
  rawResponse?: string;
  rawContent?: string;
  fullEnvelope?: {
    message?: string;
    a2ui?: A2uiPayloadItem[];
    model?: string;
    usage?: TokenUsageSummary;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ActionDebugEvent {
  timestamp: number;
  actionId?: string;
  name?: string;
  actionName?: string;
  category?: string;
  outboundMessage?: string;
  event?: unknown;
  context?: unknown;
  surfaceId?: string;
  outcome?: 'dispatched' | 'resolved' | 'rejected' | 'error';
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat messages & sessions
// ─────────────────────────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp?: number;
  model?: string;
  phase?: string;
  isAutoContinue?: boolean;
  surfaceIds?: string[];
  a2uiMessages?: A2uiPayloadItem[];
  setupEvents?: SetupGenerationEvent[];
  debugInfo?: DebugMetadata;
  usage?: TurnUsage;
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

// ─────────────────────────────────────────────────────────────────────────────
// Azure domain types (web-side — the harness is domain-agnostic)
// ─────────────────────────────────────────────────────────────────────────────

export interface AzureSubscription {
  subscriptionId: string;
  displayName: string;
  state?: string;
  tenantId?: string;
}

export interface AzureLocation {
  name: string;
  displayName: string;
  regionalDisplayName?: string;
}

export interface AzureResourceGroup {
  id: string;
  name: string;
  location: string;
  provisioningState?: string;
  tags?: Record<string, string>;
}

export interface AzureResource {
  id: string;
  name: string;
  type: string;
  location?: string;
  kind?: string;
  sku?: Record<string, unknown>;
  tags?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// GitHub domain types
// ─────────────────────────────────────────────────────────────────────────────

export interface GitHubRepo {
  id: number | string;
  name: string;
  full_name: string;
  private: boolean;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  updated_at?: string;
  default_branch?: string;
  html_url?: string;
}

export interface GitHubPullRequestSummary {
  number: number;
  html_url: string;
  title?: string;
  state?: string;
}

export interface GitHubCommitFilesParams {
  owner: string;
  repo: string;
  title: string;
  head: string;
  base: string;
  body: string;
  commitMessage: string;
  files: Array<{ path: string; content: string }>;
}

export interface GitHubCommitFilesResult {
  committedFilesCount: number;
  pullRequest: GitHubPullRequestSummary;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module augmentation: connector instance APIs the web client relies on.
//
// The harness currently exports `AzureARMConnector` / `GitHubConnector` as
// minimal class stubs. The pack-azure / pack-github implementations provide
// the runtime behaviour — we declare the expected instance shape here so
// the browser code compiles against a single well-typed surface.
// ─────────────────────────────────────────────────────────────────────────────

declare module '@kickstart/harness' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface APIConnector {
    authenticate(): Promise<void>;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface AzureARMConnector {
    authenticate(): Promise<void>;
    request(method: string, url: string, body?: unknown): Promise<Response>;
    listSubscriptions(): Promise<import('./types').AzureSubscription[]>;
    listLocations(subscriptionId: string): Promise<import('./types').AzureLocation[]>;
    listResourceGroups(subscriptionId: string): Promise<import('./types').AzureResourceGroup[]>;
    listResources(subscriptionId: string, resourceGroupName?: string): Promise<import('./types').AzureResource[]>;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface GitHubConnector {
    authenticate(): Promise<void>;
    request(method: string, path: string, body?: unknown): Promise<Response>;
    commitFilesAndCreatePullRequest(
      params: import('./types').GitHubCommitFilesParams,
    ): Promise<import('./types').GitHubCommitFilesResult>;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface InMemoryArtifactStore {
    put(path: string, content: string, opts?: { kind?: string; metadata?: Record<string, unknown> }): void;
    get(path: string): string | undefined;
    list(): string[];
  }
}

/**
 * Richer artifact model than the harness stub. The harness currently exports
 * `Artifact` / `ArtifactStore` / `APIConnector` as `Record<string, unknown>`
 * placeholders; until those land as proper interfaces, the browser code
 * imports these shapes from this module instead.
 */
export interface WebArtifact {
  path: string;
  content: string;
  language?: string;
  contentType?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface WebArtifactStore {
  list(): WebArtifact[];
  get(path: string): WebArtifact | null;
}

export interface WebAPIConnector {
  readonly name: string;
  isAuthenticated(): boolean;
  authenticate(): Promise<void>;
}
