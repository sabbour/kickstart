// TODO(Step 2): Replace these stubs with real harness types.
// This file temporarily satisfies legacy @kickstart/core imports during Step 1 migration.

// ── Phase (was an enum in v1) ────────────────────────────────────────────────
export const Phase = {
  Discover: 'discover',
  Assess: 'assess',
  Design: 'design',
  Generate: 'generate',
  Review: 'review',
  Deploy: 'deploy',
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

// ── Type-only stubs ──────────────────────────────────────────────────────────
export type PhaseItem = { id: string; label: string; status: string; [key: string]: unknown };
export type A2UIMessage = Record<string, unknown>;
export type A2UIDocument = Record<string, unknown>;
export type ChatMessage = Record<string, unknown>;
export type ConversationMessage = Record<string, unknown>;
export type CostEstimateProps = Record<string, unknown>;
export type Artifact = Record<string, unknown>;
export type ArtifactStore = Record<string, unknown>;
export type APIConnector = Record<string, unknown>;
export type AzureSubscription = Record<string, unknown>;
export type AzureLocation = Record<string, unknown>;
export type AzureContext = Record<string, unknown>;
export type GitHubRepo = Record<string, unknown>;
export type GitHubPullRequest = Record<string, unknown>;
export type OpenAIToolDefinition = Record<string, unknown>;
export type ToolCall = Record<string, unknown>;
export type ToolContext = Record<string, unknown>;
export type ConversationSkillsContext = Record<string, unknown>;
export interface SessionState {
  updatedAt: string;
  currentPhase: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  appDefinition: Record<string, unknown>;
  azureContext?: unknown;
  githubContext?: unknown;
  artifactStore?: { put(path: string, content: string, opts?: unknown): void };
  [key: string]: unknown;
}
export interface Component {
  type: string;
  [key: string]: unknown;
}
export type CardComponent = { type: string; [key: string]: unknown };
export type ColumnComponent = { type: string; [key: string]: unknown };
export type TextComponent = { type: string; [key: string]: unknown };
export type SetupGenerationRunState = Record<string, unknown>;
export type SetupGenerationSnapshot = Record<string, unknown>;
export type SetupGenerationStepId = string;
export type SetupGenerationStepState = Record<string, unknown>;

// ── Class stubs (need runtime value, not just type) ──────────────────────────

export class InMemoryArtifactStore {}

// APIConnectorRegistry stub — replaced by harness PackRegistry in Step 5
export class APIConnectorRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(_connector: any): void {}
  get(_name: string): APIConnector | undefined { return undefined; }
  names(): string[] { return []; }
}

// AzureARMConnector stub — replaced by pack-azure in Step 7
export class AzureARMConnector {
  constructor(_opts?: unknown) {}
  readonly name = 'azure-arm';
}

// GitHubConnector stub — replaced by pack-github in Step 9
export class GitHubConnector {
  constructor(_opts?: unknown) {}
  readonly name = 'github';
}

// PricingConnector stub — replaced by pack-azure in Step 7
export class PricingConnector {
  constructor(_opts?: unknown) {}
  async getPricing(_opts: unknown): Promise<unknown> { return {}; }
}

// ── Constant stubs ───────────────────────────────────────────────────────────
export const KNOWN_COMPONENT_TYPES: string[] = [];
export const SETUP_GENERATION_STEP_ORDER: string[] = [];
export const AUTO_CONTINUE_MAX_CONSECUTIVE = 5;

// ── Function stubs (kit registration — replaced by packs in Steps 4-9) ──────
export function registerKit(_kit: unknown): void {}
export const azureKit: unknown = {};
export const githubKit: unknown = {};

// ── Runtime function stubs — replaced by harness runtime in Steps 3-5 ───────
export function buildSystemPrompt(_opts: unknown): string { return ''; }
export function resolveSkills(_phase: unknown, _skills: unknown[]): unknown[] { return []; }
export function resolveConversationSkills(_ctx: unknown): unknown[] { return []; }
export function processResponse(_text: string): unknown { return {}; }
export function getPhaseDefinition(_phase: unknown): { label: string; description: string } { return { label: '', description: '' }; }
export function getPhaseOrder(): Phase[] { return Object.values(Phase); }
export function isPhase(value: unknown): value is Phase {
  return Object.values(Phase).includes(value as Phase);
}
export function shouldAutoContinue(_actionName: string): boolean { return false; }
export function synthesizeContinuationPrompt(_opts: unknown): string { return ''; }
export function synthesizeNavigationPrompt(_phase: unknown, _ctx: unknown): string { return ''; }

export const defaultKitRegistry: { getAll(): unknown[] } = { getAll: () => [] };
export const defaultRegistry: {
  toOpenAIFormat(): unknown[];
  get(_name: string): unknown;
} = {
  toOpenAIFormat: () => [],
  get: (_name: string) => undefined,
};

// ── Phase definitions — replaced by harness config in Step 2 ─────────────────
export const PHASE_DEFINITIONS: Array<{
  id: Phase; label: string; description: string; nextPhase?: Phase;
}> = [
  { id: Phase.Discover, label: 'Discover', description: '', nextPhase: Phase.Assess },
  { id: Phase.Assess, label: 'Assess', description: '', nextPhase: Phase.Design },
  { id: Phase.Design, label: 'Design', description: '', nextPhase: Phase.Generate },
  { id: Phase.Generate, label: 'Generate', description: '', nextPhase: Phase.Review },
  { id: Phase.Review, label: 'Review', description: '', nextPhase: Phase.Deploy },
  { id: Phase.Deploy, label: 'Deploy', description: '' },
];

export function advancePhase(current: Phase): Phase {
  const idx = PHASE_DEFINITIONS.findIndex((d) => d.id === current);
  return PHASE_DEFINITIONS[idx]?.nextPhase ?? current;
}

// ── Generator stubs — replaced by pack-aks in Step 6 ────────────────────────
export interface AppDefinition {
  name?: string;
  runtime?: string;
  resourceTier?: string;
  [key: string]: unknown;
}
export type GitHubContext = Record<string, unknown>;
export interface GeneratedFile { path: string; content: string; language?: string }
export interface GeneratorOutput { files: GeneratedFile[]; summary?: string; generator?: string }
export interface DeploymentSafeguard {
  id: string;
  label: string;
  description: string;
  rule: string;
  severity?: 'error' | 'warning';
  friendlyLabel?: string;
  autoFix?: boolean;
}
export const DEPLOYMENT_SAFEGUARDS: DeploymentSafeguard[] = [];
export function generateKubernetesManifests(_opts: unknown): GeneratorOutput {
  return { files: [], summary: '', generator: 'k8s' };
}
export function generateGitHubActionsWorkflow(_opts: unknown): GeneratorOutput {
  return { files: [], summary: '', generator: 'gha' };
}

// ── A2UI component type stubs ─────────────────────────────────────────────────
export type RowComponent = { type: string; [key: string]: unknown };
export type CodeBlockComponent = { type: string; [key: string]: unknown };
export type ConversationPhaseComponent = {
  type: 'ConversationPhase';
  id: string;
  phases: PhaseItem[];
  currentPhase: Phase;
  [key: string]: unknown;
};
export type GenerationProgressComponent = { type: string; [key: string]: unknown };
