// @aks-kickstart/harness barrel — canonical harness surface for packs, runtime, and adapters.
//
// Historical stubs retained here are still referenced by v1 callers in
// mcp-server/src/tools/*, mcp-server/src/a2ui.ts, and web/api/src/lib/session-store.ts.
// Each stub block is annotated with the pack / runtime module that will own it
// once the remaining v1 callers are migrated; see docs-site/docs/architecture/v2-implementation-brief.md §2.

// ── Phase (was an enum in v1) ────────────────────────────────────────────────
// Canonical order per docs-site/docs/architecture/v2-implementation-brief.md §2:
// Discover → Design → Generate → Review → Handoff → Deploy
export const Phase = {
  Discover: 'discover',
  Design: 'design',
  Generate: 'generate',
  Review: 'review',
  Handoff: 'handoff',
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
export interface Artifact {
  path: string;
  content: string;
  [key: string]: unknown;
}

export interface ArtifactStore {
  list(): Artifact[];
  get(path: string): Artifact | null;
  put(path: string, content: string, opts?: unknown): void;
  clear?(): void;
  [key: string]: unknown;
}
export interface APIConnector {
  readonly name: string;
  isAuthenticated?: () => boolean;
  authenticate?: () => Promise<void>;
}

export interface AzureSubscription {
  id?: string;
  subscriptionId: string;
  displayName: string;
  tenantId?: string;
  state?: string;
  [key: string]: unknown;
}

export interface AzureLocation {
  name: string;
  displayName: string;
  regionalDisplayName?: string;
  subscriptionId?: string;
  [key: string]: unknown;
}

export interface AzureResourceGroup {
  id: string;
  name: string;
  location: string;
  subscriptionId?: string;
  tags?: Record<string, string>;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AzureResource {
  id: string;
  name: string;
  type: string;
  location: string;
  kind?: string;
  resourceGroup?: string;
  subscriptionId?: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

export type AzureContext = Record<string, unknown>;

export interface GitHubRepoOwner {
  login: string;
  id?: number;
  avatar_url?: string;
  type?: string;
  [key: string]: unknown;
}

export interface GitHubRepo {
  id?: number;
  name: string;
  full_name: string;
  owner: GitHubRepoOwner;
  private?: boolean;
  html_url?: string;
  default_branch?: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  updated_at?: string;
  [key: string]: unknown;
}

export interface GitHubPullRequest {
  number: number;
  html_url: string;
  title?: string;
  state?: string;
  [key: string]: unknown;
}

export interface GitHubCommitFilesInput {
  owner: string;
  repo: string;
  title: string;
  head: string;
  base: string;
  body?: string;
  commitMessage: string;
  files: Array<{ path: string; content: string }>;
}

export interface GitHubCommitFilesResult {
  pullRequest: GitHubPullRequest;
  committedFilesCount: number;
}
export type OpenAIToolDefinition = Record<string, unknown>;
export type ToolCall = Record<string, unknown>;
export type ToolContext = Record<string, unknown>;
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
export type SetupGenerationStepState = Record<string, unknown>;

// ── Class stubs (need runtime value, not just type) ──────────────────────────

export class InMemoryArtifactStore implements ArtifactStore {
  private readonly items = new Map<string, Artifact>();
  list(): Artifact[] { return Array.from(this.items.values()); }
  get(path: string): Artifact | null { return this.items.get(path) ?? null; }
  put(path: string, content: string, _opts?: unknown): void {
    this.items.set(path, { path, content });
  }
  clear(): void { this.items.clear(); }
  [key: string]: unknown;
}

// APIConnectorRegistry stub — replaced by harness PackRegistry in Step 5
export class APIConnectorRegistry {
  private readonly connectors = new Map<string, APIConnector>();
  register(connector: APIConnector): void {
    if (connector && typeof connector.name === 'string') {
      this.connectors.set(connector.name, connector);
    }
  }
  get(name: string): APIConnector | undefined { return this.connectors.get(name); }
  names(): string[] { return Array.from(this.connectors.keys()); }
}

// AzureARMConnector stub — replaced by pack-azure in Step 7
export class AzureARMConnector {
  constructor(_opts?: unknown) {}
  readonly name: string = 'azure-arm';
  isAuthenticated(): boolean { return false; }
  async authenticate(): Promise<void> { /* stub */ }
  async listSubscriptions(): Promise<AzureSubscription[]> { return []; }
  async listLocations(_subscriptionId: string): Promise<AzureLocation[]> { return []; }
  async listResourceGroups(_subscriptionId: string): Promise<AzureResourceGroup[]> { return []; }
  async listResources(_subscriptionId: string): Promise<AzureResource[]> { return []; }
  async request(_method: string, _path: string, _body?: unknown): Promise<Response> {
    throw new Error('AzureARMConnector.request is a stub — replaced by pack-azure in Step 7.');
  }
}

// GitHubConnector stub — replaced by pack-github in Step 9
export class GitHubConnector {
  constructor(_opts?: unknown) {}
  readonly name: string = 'github';
  isAuthenticated(): boolean { return false; }
  async authenticate(): Promise<void> { /* stub */ }
  async request(_method: string, _path: string, _body?: unknown): Promise<Response> {
    throw new Error('GitHubConnector.request is a stub — replaced by pack-github in Step 9.');
  }
  async commitFilesAndCreatePullRequest(_input: GitHubCommitFilesInput): Promise<GitHubCommitFilesResult> {
    throw new Error('GitHubConnector.commitFilesAndCreatePullRequest is a stub — replaced by pack-github in Step 9.');
  }
}

// PricingConnector stub — replaced by pack-azure in Step 7
/** Minimal subset of the Azure Retail Prices API response needed by cost-estimate.ts. */
export interface RetailPriceItem {
  currencyCode: string;
  retailPrice: number;
  unitPrice: number;
  armRegionName: string;
  location: string;
  meterName: string;
  productId: string;
  skuId: string;
  productName: string;
  skuName: string;
  serviceName: string;
  serviceFamily: string;
  unitOfMeasure: string;
  type: string;
  isPrimaryMeterRegion: boolean;
  armSkuName?: string;
  effectiveStartDate: string;
  tierMinimumUnits: number;
  meterId?: string;
  reservationTerm?: string;
}
export interface VmPriceResult {
  vmSize: string;
  region: string;
  payAsYouGo: number;
  reserved1Year?: number;
  reserved3Years?: number;
  currency: string;
}

const RETAIL_PRICES_BASE = 'https://prices.azure.com';

export class PricingConnector {
  readonly name: string = 'pricing';
  private _maxRetries: number;

  constructor(opts?: { retry?: { maxRetries?: number } }, _cacheTtlMs?: number) {
    this._maxRetries = opts?.retry?.maxRetries ?? 0;
  }

  /** Fetch items from the Azure Retail Prices API (mirrors v2-rewrite interface). */
  async fetchRetailPrices(query: {
    filter: string;
    maxPages?: number;
    signal?: AbortSignal;
  }): Promise<RetailPriceItem[]> {
    const url = `${RETAIL_PRICES_BASE}/api/retail/prices?$filter=${encodeURIComponent(query.filter)}`;
    let lastError: unknown;
    for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
      try {
        const response = await fetch(url, { signal: query.signal });
        if (!response.ok) {
          throw new Error(`Azure Pricing API returned ${response.status}: ${response.statusText}`);
        }
        const body = (await response.json()) as { Items: RetailPriceItem[]; NextPageLink: string | null };
        return body.Items ?? [];
      } catch (err) {
        lastError = err;
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        if (attempt < this._maxRetries) continue;
      }
    }
    throw lastError;
  }

  /** Convenience lookup for VM hourly price by SKU + region. */
  async lookupVmPrice(
    vmSize: string,
    region: string,
    signal?: AbortSignal,
  ): Promise<VmPriceResult | null> {
    const skuName = vmSize.replace(/^Standard_/, '').replace(/_/g, ' ');
    const filter = [
      `serviceName eq 'Virtual Machines'`,
      `armRegionName eq '${region}'`,
      `skuName eq '${skuName}'`,
      `isPrimaryMeterRegion eq true`,
    ].join(' and ');
    try {
      const items = await this.fetchRetailPrices({ filter, maxPages: 1, signal });
      const consumption = items.find(
        (i) => i.type === 'Consumption' && !i.productName.includes('Windows') && !i.productName.includes('Spot') && i.armSkuName === vmSize,
      );
      if (!consumption) return null;
      return { vmSize, region, payAsYouGo: consumption.retailPrice, currency: consumption.currencyCode };
    } catch {
      return null;
    }
  }

  /** @deprecated Use fetchRetailPrices instead. */
  async getPricing(_opts: unknown): Promise<unknown> { return {}; }
}

// ── Constant stubs ───────────────────────────────────────────────────────────
export const KNOWN_COMPONENT_TYPES: string[] = [];
// Step order matches v2-rewrite setup-generation.ts
export const SETUP_GENERATION_STEP_ORDER = [
  'app-scaffolding',
  'dockerfile',
  'deployment-config',
  'ci-cd',
  'service-connections',
] as const;
export type SetupGenerationStepId = typeof SETUP_GENERATION_STEP_ORDER[number];
export const AUTO_CONTINUE_MAX_CONSECUTIVE = 5;

// ── Runtime function stubs — replaced by harness runtime in Steps 3-5 ───────
export function buildSystemPrompt(_opts: unknown): string { return 'You are Kickstart, an AI-guided deployment assistant.'; }
export function processResponse(_text: string): unknown { return {}; }
export function getPhaseDefinition(_phase: unknown): { label: string; description: string; nextPhase?: Phase } {
  return PHASE_DEFINITIONS.find((d) => d.id === _phase) ?? { label: '', description: '' };
}
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

// Phase definitions matching the current harness order.
export const PHASE_DEFINITIONS: Array<{
  id: Phase; label: string; description: string; nextPhase?: Phase;
}> = [
  { id: Phase.Discover, label: 'Discover', description: 'What are you building?', nextPhase: Phase.Design },
  { id: Phase.Design, label: 'Design', description: 'Here is the recommended architecture.', nextPhase: Phase.Generate },
  { id: Phase.Generate, label: 'Generate', description: 'Generating your deployment files.', nextPhase: Phase.Review },
  { id: Phase.Review, label: 'Review', description: 'Review and validate your artifacts.', nextPhase: Phase.Handoff },
  { id: Phase.Handoff, label: 'Handoff', description: 'Hand off to the target platform.', nextPhase: Phase.Deploy },
  { id: Phase.Deploy, label: 'Deploy', description: 'Deploy to AKS.' },
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
// Safeguards DS001–DS013 preserved from v2-rewrite (replaced by pack-aks in Step 6)
export const DEPLOYMENT_SAFEGUARDS: DeploymentSafeguard[] = [
  { id: 'DS001', label: 'Resource limits', description: 'Every container must define resources.requests AND resources.limits.', rule: 'resource-limits-required', severity: 'error', autoFix: true },
  { id: 'DS002', label: 'Health probes', description: 'Every container must define livenessProbe and readinessProbe.', rule: 'health-probes-required', severity: 'error', autoFix: true },
  { id: 'DS003', label: 'Non-root user', description: 'securityContext.runAsNonRoot must be true on all pods.', rule: 'run-as-non-root', severity: 'error', autoFix: true },
  { id: 'DS004', label: 'No privilege escalation', description: 'securityContext.allowPrivilegeEscalation must be false.', rule: 'no-privilege-escalation', severity: 'error', autoFix: true },
  { id: 'DS005', label: 'No host networking', description: 'hostNetwork, hostPID, and hostIPC must be false or unset.', rule: 'no-host-networking', severity: 'error', autoFix: true },
  { id: 'DS006', label: 'No latest tag', description: 'Container images must not use the :latest tag.', rule: 'no-latest-image-tag', severity: 'error', autoFix: false },
  { id: 'DS007', label: 'Read-only root filesystem', description: 'readOnlyRootFilesystem should be true where the application permits.', rule: 'read-only-root-filesystem', severity: 'warning', autoFix: true },
  { id: 'DS008', label: 'Gateway API for ingress', description: 'Use Gateway API (HTTPRoute) for ingress, not the legacy Ingress resource.', rule: 'gateway-api-for-ingress', severity: 'error', autoFix: true },
  { id: 'DS009', label: 'Workload identity', description: 'Azure access must use Workload Identity, not stored credentials.', rule: 'workload-identity-required', severity: 'error', autoFix: false },
  { id: 'DS010', label: 'ACR with AcrPull', description: 'Container images must be pulled from ACR with AcrPull role binding.', rule: 'acr-with-acrpull', severity: 'error', autoFix: false },
  { id: 'DS011', label: 'Resource quotas (production)', description: 'Production-tier deployments must define ResourceQuota in the namespace.', rule: 'resource-quotas-production', severity: 'warning', autoFix: true },
  { id: 'DS012', label: 'Network policies (production)', description: 'Production-tier deployments must define NetworkPolicy for pod-to-pod traffic.', rule: 'network-policies-production', severity: 'warning', autoFix: true },
  { id: 'DS013', label: 'Pod disruption budget (production)', description: 'Production-tier deployments must define PodDisruptionBudget for high availability.', rule: 'pod-disruption-budget-production', severity: 'warning', autoFix: true },
];
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

export type { Pack, PlaygroundStub } from './types/pack.js';
export type { AgentContribution, ContributionSource, Handoff, ModelRef } from './types/agent.js';
export type { Skill } from './types/skill.js';
export type { ToolContribution } from './types/tool.js';
export type { UserActionContribution } from './types/user-action.js';
export type { ComponentContribution } from './types/component.js';
export type { GuardrailContribution, GuardrailInput, GuardrailResult } from './types/guardrail.js';
export type { PlaygroundScenario } from './types/playground.js';
export type {
  A2UIComponent,
  A2UIDataValue,
  A2UIMessageEnvelope,
  A2UIMessageInput,
  A2UIMessageV09,
  A2UIVersion,
  CreateSurfaceMessage,
  DeleteSurfaceMessage,
  UpdateComponentsMessage,
  UpdateDataModelMessage,
} from './types/a2ui.js';
export type {
  AppIntent,
  A2UICatalog,
  AzureCredential,
  PendingUserAction,
  SessionCtx,
  Turn,
} from './types/session.js';
export type { AgentOutputType } from './types/agent-output.js';

export {
  AgentOutput,
} from './types/agent-output.js';
export {
  A2UI_VERSION,
  A2UIMessageEnvelopeSchema,
  A2UIMessageSchema,
  CreateSurfaceMessagePayload,
  CreateSurfaceMessageSchema,
  DeleteSurfaceMessagePayload,
  DeleteSurfaceMessageSchema,
  UpdateComponentsMessagePayload,
  UpdateComponentsMessageSchema,
  UpdateDataModelMessagePayload,
  UpdateDataModelMessageSchema,
} from './types/a2ui.js';
export {
  CONVERSATION_PHASE_LABELS,
  CONVERSATION_PHASE_ORDER,
  extractConversationPhase,
  getLatestConversationPhase,
  isA2UIMessage,
  normalizeConversationPhase,
  prepareChatA2ui,
  prepareChatA2uiPayload,
  rebuildChatSessionState,
} from './a2ui/chat-a2ui.js';
export type {
  ConversationPhaseId,
  GeneratedChatFile,
  PersistedChatTurn,
  PreparedChatA2ui,
  PrepareChatA2uiOptions,
} from './a2ui/chat-a2ui.js';

// ── Step 6: Skill Resolver ───────────────────────────────────────────────────
export { estimateTokens, buildSkillPrompt, fitSkillsInBudget } from './runtime/token-budget.js';
export { matchesSkill } from './runtime/skill-matcher.js';
export { PackRegistry } from './runtime/registry.js';
export { resolveSkills } from './runtime/skill-resolver.js';
export type { ResolveSkillsOptions } from './runtime/skill-resolver.js';
export {
  walkSchema,
  collectMissingProperties,
  collectStrictRequiredViolations,
  collectAdditionalPropertiesViolations,
  collectMissingTypes,
  reportSchemaConformance,
  reportHasIssues,
  formatReport,
  getToolJsonSchema,
  getUserActionJsonSchema,
} from './runtime/schema-conformance.js';
export type {
  SchemaNode,
  SchemaVisitor,
  SchemaConformanceReport,
} from './runtime/schema-conformance.js';

// ── Step 11–12: Runner + Resume ──────────────────────────────────────────────
export { Runner } from './runtime/runner.js';
export { Session, sessionStore, getOrCreateSession, getOrCreateSessionResult, generateAnonSessionToken, validateAnonSessionToken, isAnonymousSession, ANON_SESSION_TTL_MS, AnonTokenGenerationError } from './runtime/session.js';
export type { ISessionStore, IAsyncSessionStore, EvictionSchedulerHandle } from './runtime/session-store.js';
export { InMemorySessionStore, createSessionStore, startEvictionScheduler } from './runtime/session-store.js';
export { AzureTableSessionStore } from './runtime/session-store-azure-table.js';
export type { AzureTableSessionStoreOptions } from './runtime/session-store-azure-table.js';
export type { ResumeHandlerInput, ResumeHandlerResult, ClientPrincipal } from './runtime/resume.js';

// ── Step 12: MCP adapter utilities ──────────────────────────────────────────
export {
  isVsCodeClient,
  buildMcpManifest,
  buildA2UIContent,
  buildInterruptContent,
} from './mcp/server.js';
export type {
  McpToolDescriptor,
  McpInterruptBlock,
  McpContentItem,
  McpTextContent,
  A2UIEmbeddedResource,
} from './mcp/server.js';
