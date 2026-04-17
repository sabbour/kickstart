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

export interface AgentContribution {
  name: string;
  description: string;
  model: ModelRef;
  toolAllowlist: string[];
  handoffs: Handoff[];
  userInvocable: boolean;
  modelInvocable: boolean;
  instructionsBase: string;
  outputType?: 'AgentOutput';
  mcpExposed?: boolean;
  source: ContributionSource;
}
