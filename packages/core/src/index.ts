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
  FileEditorFileEntry,
  FileEditorComponent,
  AuthCardComponent,
  GenerationProgressComponent,
  GenerationStep,
  CostItem,
  CostEstimateProps,
  CostEstimateResource,
  CostEstimateSkuOption,
  CostEstimatePricingTier,
  CostEstimatePricingKind,
  CostEstimatePricingLineItem,
  CostEstimatePricingRequest,
  CostEstimateResourcePricingModel,
  CostEstimateLoadingState,
  CostEstimateCacheMetadata,
  CostEstimateFallbackMetadata,
  PhaseItem,
  ResourceOption,
} from "./catalog/index.js";

// Engine
export {
  Phase,
  PHASE_DEFINITIONS,
  getPhaseDefinition,
  getPhaseOrder,
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
  CopilotSkillsRegistry,
  defaultCopilotSkillsRegistry,
  AZURE_COPILOT_SKILLS,
  formatCopilotSkillsPrompt,
} from "./engine/index.js";
export type {
  PhaseDefinition,
  ResolvedSkills,
  Skill,
  SkillResolverContext,
  SkillResolverMiddleware,
  CopilotSkill,
  ResolvedCopilotSkills,
} from "./engine/index.js";

// Setup generation shared contract
export {
  SETUP_GENERATION_STEP_ORDER,
  SETUP_GENERATION_STEP_LABELS,
  SETUP_GENERATION_FILE_LANGUAGE_ALLOWLIST,
  SETUP_GENERATION_QUOTAS,
} from "./setup-generation.js";
export type {
  SetupGenerationStepId,
  SetupGenerationFileLanguage,
  SetupGenerationStepStatus,
  SetupGenerationRunStatus,
  SetupGenerationControlAction,
  SetupGenerationErrorCode,
  SetupGenerationStepState,
  SetupGeneratedFileManifest,
  SetupGenerationStepError,
  SetupGenerationRunState,
  SetupGenerationSnapshot,
  SetupGenerationStepStartEvent,
  SetupGenerationFileGeneratedEvent,
  SetupGenerationStepCompleteEvent,
  SetupGenerationStepErrorEvent,
  SetupGenerationEvent,
} from "./setup-generation.js";

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
  BASE_COMPONENT_CATALOG,
  generateComponentCatalogSection,
} from "./prompts/index.js";
export type {
  DeploymentSafeguard,
  SafeguardSeverity,
  SystemPromptContext,
  ComponentCatalogEntry,
  ComponentCategory,
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

// Services (response processing + per-turn skill injection)
export { processResponse, resolveConversationSkills } from "./services/index.js";
export type {
  ProcessedResponse,
  A2UIMessage,
  A2UIMessageType,
  Action,
  ConversationSkillsContext,
  ConversationSkillsResult,
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
export type {
  GitHubRepo,
  GitHubBranch,
  GitHubRepoOptions,
  GitHubUser,
  GitHubDeviceCodeResponse,
  GitHubPullRequest,
  GitHubCommitFile,
  GitHubCommitPullRequestInput,
  GitHubCommitPullRequestResult,
  GitHubConnectorConfig,
} from "./connectors/index.js";
export { PricingConnector } from "./connectors/index.js";
export type {
  ResourceCostInput,
  ResourceCostEstimate,
  CostEstimateResult,
  RetailPriceItem,
  RetailPricesResponse,
  RetailPriceQuery,
  VmPriceResult,
} from "./connectors/index.js";

// IntegrationKit system — composable bundles of tools, connectors, prompts, components
export type { IntegrationKit, ComponentRegistration, KitAuthRequirement } from "./kits/index.js";
export { IntegrationKitRegistry, defaultKitRegistry, registerKit } from "./kits/index.js";
export { azureKit } from "./kits/index.js";
export { githubKit } from "./kits/index.js";

// Public Copilot skills — build-time bundled external skill consumption (#186)
export type {
  PublicSkillSource,
  PublicSkillsConfig,
  SkillProvenance,
  SkillKnowledgeBlock,
  PolicyViolation,
  PublicSkillsLockfile,
  LockfileSkillEntry,
} from "./skills/index.js";
export {
  loadPublicSkills,
  loadPublicSkillKit,
  createPublicSkillKit,
  syncPublicSkills,
  validateConfig as validatePublicSkillsConfig,
  scanSkillPolicy,
  parseSkillMd,
  classifyToPhases,
  PUBLIC_SKILL_PRIORITY,
  POLICY_VERSION,
  SHA_PATTERN,
} from "./skills/index.js";

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
