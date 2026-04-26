// Web-client view-model types.
//
// These are *frontend* types used by React components, hooks, and utils.
// They are deliberately decoupled from the harness-side runtime types —
// the harness transmits JSON payloads that the web client adapts into
// view models declared here.

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------

export type AppMode = 'landing' | 'chat' | 'playground';

// ---------------------------------------------------------------------------
// Conversation phases
// ---------------------------------------------------------------------------

export type ConversationPhaseId =
  | 'discover'
  | 'design'
  | 'generate'
  | 'review'
  | 'handoff'
  | 'deploy';

// ---------------------------------------------------------------------------
// A2UI view-model types
//
// The harness emits A2UI v0.9 messages plus occasional inline ConversationPhase
// components. The renderer treats anything with a `version: 'v0.9'` envelope or
// a `type: 'ConversationPhase'` descriptor as an A2UI payload item.
// ---------------------------------------------------------------------------

export interface A2uiComponent {
  id?: string;
  component?: string;
  type?: string;
  [key: string]: unknown;
}

export interface A2uiCreateSurfaceMsg {
  version: 'v0.9';
  createSurface: {
    surfaceId: string;
    catalogId: string;
    theme?: unknown;
    sendDataModel?: boolean;
  };
  updateComponents?: undefined;
  updateDataModel?: undefined;
  deleteSurface?: undefined;
}

export interface A2uiUpdateComponentsMsg {
  version: 'v0.9';
  createSurface?: undefined;
  updateComponents: {
    surfaceId: string;
    components: A2uiComponent[];
  };
  updateDataModel?: undefined;
  deleteSurface?: undefined;
}

export interface A2uiUpdateDataModelMsg {
  version: 'v0.9';
  createSurface?: undefined;
  updateComponents?: undefined;
  updateDataModel: {
    surfaceId: string;
    path?: string;
    value?: unknown;
  };
  deleteSurface?: undefined;
}

export interface A2uiDeleteSurfaceMsg {
  version: 'v0.9';
  createSurface?: undefined;
  updateComponents?: undefined;
  updateDataModel?: undefined;
  deleteSurface: {
    surfaceId: string;
  };
}

export type A2uiMsg =
  | A2uiCreateSurfaceMsg
  | A2uiUpdateComponentsMsg
  | A2uiUpdateDataModelMsg
  | A2uiDeleteSurfaceMsg;

/**
 * A raw payload item as persisted or streamed from the server. Either an A2UI
 * v0.9 message envelope or a standalone ConversationPhase descriptor (legacy
 * v1-compat shape still emitted for phase tracking).
 */
export type A2uiPayloadItem =
  | A2uiMsg
  | {
      type: 'ConversationPhase';
      id?: string;
      currentPhase?: string;
      phases?: Array<{ id: string; label: string; status: string }>;
    };

// ---------------------------------------------------------------------------
// Stepwise setup events (v1-compat, may still arrive during migration)
// ---------------------------------------------------------------------------

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
      byteLength?: number;
      sha256: string;
      content?: string;
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

// ---------------------------------------------------------------------------
// Token usage tracking
// ---------------------------------------------------------------------------

export type CostStatus = 'estimated' | 'unavailable';

export interface TurnUsage {
  model?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  recordedAt?: string;
  estimatedCostUsd?: number;
  costStatus: CostStatus;
}

export interface SessionUsageTotals {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  turnCount: number;
  estimatedCostUsd?: number;
  costStatus: CostStatus;
}

export interface TokenUsageSummary {
  turn: TurnUsage;
  session: SessionUsageTotals;
}

// ---------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------

/** Per-turn tool execution record surfaced on the SSE `end` event (#958). */
export interface DebugToolExecution {
  name: string;
  status: 'ok' | 'error';
}

export interface DebugMetadata {
  model?: string;
  systemPrompt?: string;
  rawResponse?: string;
  rawContent?: string;
  /** Agent that owned this turn (e.g. `core.triage`). Populated from SSE `end` event. */
  agentName?: string;
  /** Skill IDs matched/executed during this turn. Populated from SSE `end` event. */
  skillsExecuted?: string[];
  /** Tool invocations attempted during this turn. Populated from SSE `end` event. */
  toolsExecuted?: DebugToolExecution[];
  fullEnvelope?: {
    message?: string;
    model?: string;
    a2ui?: A2uiPayloadItem[];
    usage?: TokenUsageSummary;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ActionDebugEvent {
  actionName: string;
  category: string;
  context: Record<string, unknown>;
  outboundMessage: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Chat message view model
// ---------------------------------------------------------------------------

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  intent?: 'warning';
  retryable?: boolean;
  retryText?: string;
  retrySessionId?: string;
  model?: string;
  phase?: ConversationPhaseId | string | null;
  timestamp?: number;
  a2uiMessages?: A2uiPayloadItem[];
  setupEvents?: SetupGenerationEvent[];
  surfaceIds?: string[];
  isAutoContinue?: boolean;
  debugInfo?: DebugMetadata;
  /** Per-turn usage. The session-wide summary is derived via summarizeTokenUsage. */
  usage?: TurnUsage;
}

// ---------------------------------------------------------------------------
// Session (frontend persistence model — keyed off localStorage)
// ---------------------------------------------------------------------------

export interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  currentPhase?: ConversationPhaseId | null;
  createdAt: number;
  updatedAt: number;
  /** Server-side conversation session id. Set after the first /api/converse response. */
  backendSessionId?: string;
}
