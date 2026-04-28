export interface ContributionSource {
  kind: 'file' | 'inline';
  path?: string;
}

export type ModelRef =
  | { envVar: string }
  | { id: string };

export interface Handoff {
  label: string;
  agent: string;
  prompt?: string;
  send?: boolean;
  model?: ModelRef;
}

/** Declares a specialist agent callable as a bounded tool (mid-task consultation). */
export interface AsToolRef {
  /** Agent ID to wrap, e.g. `aks.architect`. */
  agent: string;
  /** Human-readable description injected into the tool definition for the calling LLM. */
  description?: string;
  /** Override the generated tool name (defaults to `ask_<sanitised-agent-name>`). */
  toolName?: string;
  /** Maximum SDK loop iterations for the consultation (defaults to AS_TOOL_MAX_TURNS_DEFAULT). */
  maxTurns?: number;
}

export interface AgentContribution {
  name: string;
  description: string;
  model: ModelRef;
  toolAllowlist: string[];
  handoffs: Handoff[];
  /** Specialist agents this agent may consult as bounded tools (mid-task, no handoff). */
  asTools?: AsToolRef[];
  userInvocable: boolean;
  modelInvocable: boolean;
  instructionsBase: string;
  outputType?: 'AgentOutput';
  mcpExposed?: boolean;
  source: ContributionSource;
}
