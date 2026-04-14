/**
 * @kickstart/core — Conversation engine, A2UI catalog, and code generators
 * for the AKS Kickstart onboarding experience.
 */

// Catalog types
export type {
  A2UIDocument,
  Component,
  BaseComponent,
  TextComponent,
  ImageComponent,
  IconComponent,
  VideoComponent,
  AudioPlayerComponent,
  RowComponent,
  ColumnComponent,
  ListComponent,
  CardComponent,
  TabsComponent,
  TabDef,
  DividerComponent,
  ModalComponent,
  ButtonComponent,
  ButtonAction,
  TextFieldComponent,
  CheckBoxComponent,
  ChoicePickerComponent,
  ChoiceOption,
  SliderComponent,
  DateTimeInputComponent,
  CostEstimateComponent,
  ArchitectureDiagramComponent,
  ArchNode,
  ArchEdge,
  FileEditorComponent,
  AuthCardComponent,
  DeploymentProgressComponent,
  DeploymentStep,
  CostItem,
  PhaseItem,
  ResourceOption,
} from "./catalog/index.js";

// Engine
export {
  Phase,
  PHASE_DEFINITIONS,
  getPhaseDefinition,
  getPhaseOrder,
  createInitialState,
  transition,
  getCurrentPhase,
  canAdvance,
  resolveSkills,
  resolveSkillsAsync,
  resolveSkillsFromList,
  formatSkillsSection,
  registerSkillMiddleware,
  AUTO_CONTINUE_PREFIXES,
  AUTO_CONTINUE_MAX_CONSECUTIVE,
  shouldAutoContinue,
  synthesizeContinuationPrompt,
  synthesizeNavigationPrompt,
  resolveDataPath,
  interpolateTemplate,
  createDefaultValues,
  interpolateA2UIMessage,
} from "./engine/index.js";
export type {
  PhaseStatus,
  ConversationState,
  PhaseDefinition,
  ConversationEvent,
  ResolvedSkills,
  Skill,
  SkillResolverContext,
  SkillResolverMiddleware,
} from "./engine/index.js";

// Generators
export {
  generateKubernetesManifests,
  generateGitHubActionsWorkflow,
} from "./generators/index.js";
export type {
  GeneratorInput,
  GeneratorOutput,
  GeneratedFile,
} from "./generators/index.js";

// Prompts (Layer 2 system prompt + composition)
export {
  KICKSTART_SYSTEM_PROMPT,
  DEPLOYMENT_SAFEGUARDS,
  buildSystemPrompt,
  sanitizePromptValue,
} from "./prompts/index.js";
export type {
  DeploymentSafeguard,
  SafeguardSeverity,
  SystemPromptContext,
} from "./prompts/index.js";

// Tool registry
export { ToolRegistry, defaultRegistry } from "./tools/registry.js";
export { githubApiGet } from "./tools/github-api-get.js";
export { fetchWebpage } from "./tools/fetch-webpage.js";
export type { Tool, ToolContext, OpenAIToolDefinition, ToolCall, ToolCallResult } from "./tools/types.js";

// Artifact store — generated files (K8s manifests, Dockerfiles, CI workflows, etc.)
export type { Artifact, ArtifactStore, ArtifactStoreQuota } from "./artifacts/index.js";
export { ArtifactQuotaExceededError, DEFAULT_ARTIFACT_QUOTA } from "./artifacts/index.js";
export { InMemoryArtifactStore, defaultArtifactStore } from "./artifacts/index.js";

// Services (response processing)
export { processResponse } from "./services/index.js";
export type {
  ProcessedResponse,
  A2UIMessage,
  A2UIMessageType,
  Action,
} from "./services/index.js";

// A2UI schema validation (Issue #153)
export {
  PAYLOAD_LIMITS,
  KNOWN_COMPONENT_TYPES,
  COMPONENT_SCHEMA_REGISTRY,
  A2UIMessageSchema,
  ActionSchema,
  checkDepth,
} from "./services/index.js";
export type { KnownComponentType } from "./services/index.js";

// APIConnectors — authenticated API client adapters
export type {
  APIConnector,
  ConfigurableConnector,
  APIConnectorRequestOptions,
  HttpMethod,
  AuthStrategy,
  OAuth2AuthStrategy,
  APIKeyAuthStrategy,
  ManagedIdentityAuthStrategy,
  NoAuthStrategy,
  TokenInfo,
  TokenProvider,
  RetryConfig,
  CORSProxyConfig,
  ConnectorConfig,
  ConnectorErrorCode,
} from "./connectors/index.js";
export { ConnectorError, DEFAULT_RETRY_CONFIG } from "./connectors/index.js";
export { withRetry, calculateDelay, parseRetryAfter } from "./connectors/index.js";
export { BaseConnector } from "./connectors/index.js";
export { APIConnectorRegistry, defaultConnectorRegistry } from "./connectors/index.js";
export { AzureARMConnector } from "./connectors/index.js";
export type { AzureResource, AzureResourceGroup, AzureSubscription, AzureLocation } from "./connectors/index.js";
export { GitHubConnector } from "./connectors/index.js";
export type { GitHubRepo, GitHubBranch, GitHubRepoOptions, GitHubUser, GitHubDeviceCodeResponse, GitHubPullRequest } from "./connectors/index.js";
export { PricingConnector } from "./connectors/index.js";
export type { ResourceCostInput, ResourceCostEstimate, CostEstimateResult } from "./connectors/index.js";

// IntegrationKit system — composable bundles of tools, connectors, prompts, components
export type { IntegrationKit, ComponentRegistration, KitAuthRequirement } from "./kits/index.js";
export { IntegrationKitRegistry, defaultKitRegistry, registerKit } from "./kits/index.js";
export { azureKit } from "./kits/index.js";
export { githubKit } from "./kits/index.js";

// Validation — client-side artifact validation against deployment safeguards
export type {
  ValidationSeverity,
  ValidationResult,
  Validator,
  ArtifactValidationReport,
} from "./validation/index.js";
export type {
  RuleCategory,
  AksConstraintFamily,
  ValidationRule,
  CategorisedValidationReport,
  RulesEngineSummary,
} from "./validation/index.js";
export { ValidationEngine, createDefaultValidationEngine, validateAndFixArtifacts } from "./validation/index.js";
export { RulesEngine, createDefaultRulesEngine, ALL_RULES } from "./validation/index.js";
export { resourceLimitsValidator } from "./validation/index.js";
export { noLatestTagValidator } from "./validation/index.js";
export { healthProbesValidator } from "./validation/index.js";
export { noPrivilegedValidator } from "./validation/index.js";
export { namespaceSetValidator } from "./validation/index.js";
export { replicaCountValidator } from "./validation/index.js";
export { imagePullPolicyValidator } from "./validation/index.js";
export { runAsNonRootValidator } from "./validation/index.js";
export { noPrivilegeEscalationValidator } from "./validation/index.js";
export { noHostNetworkingValidator } from "./validation/index.js";
export { readOnlyRootFsValidator } from "./validation/index.js";
export { gatewayApiIngressValidator } from "./validation/index.js";
export { noImagePullSecretsValidator } from "./validation/index.js";
export { resourceQuotasValidator } from "./validation/index.js";
export { networkPoliciesValidator } from "./validation/index.js";
export { podDisruptionBudgetValidator } from "./validation/index.js";
export { containerPortNamesValidator } from "./validation/index.js";
export { dropAllCapabilitiesValidator } from "./validation/index.js";
export { noHostPidValidator } from "./validation/index.js";
export { noHostIpcValidator } from "./validation/index.js";
export { serviceAccountTokenValidator } from "./validation/index.js";
export { labelRequirementsValidator } from "./validation/index.js";
export { topologySpreadConstraintsValidator } from "./validation/index.js";

// Telemetry — structured logger with in-memory ring buffer
export { Logger, logger, getLogEntries } from "./telemetry/index.js";
export type { LogLevel, LogEntry, TrackEntry, LogRecord } from "./telemetry/index.js";

// Shared types
export type {
  AzureContext,
  GitHubContext,
  AppDefinition,
  AppRuntime,
  SessionState,
  ConversationMessage,
} from "./types.js";


