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
} from "./engine/index.js";
export type {
  PhaseStatus,
  ConversationState,
  PhaseDefinition,
  ConversationEvent,
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
} from "./prompts/index.js";
export type {
  DeploymentSafeguard,
  SafeguardSeverity,
  SystemPromptContext,
} from "./prompts/index.js";

// Tool registry
export { ToolRegistry, defaultRegistry } from "./tools/registry.js";
export type { Tool, OpenAIToolDefinition, ToolCall, ToolCallResult } from "./tools/types.js";

// Services (response processing)
export { processResponse } from "./services/index.js";
export type {
  ProcessedResponse,
  A2UIMessage,
  A2UIMessageType,
  Action,
} from "./services/index.js";

// APIConnectors — authenticated API client adapters
export type { APIConnector, APIConnectorRequestOptions } from "./connectors/index.js";
export { APIConnectorRegistry, defaultConnectorRegistry } from "./connectors/index.js";
export { AzureARMConnector } from "./connectors/index.js";
export type { AzureResource, AzureResourceGroup } from "./connectors/index.js";
export { GitHubConnector } from "./connectors/index.js";
export type { GitHubRepo, GitHubBranch, GitHubRepoOptions } from "./connectors/index.js";
export { PricingConnector } from "./connectors/index.js";
export type { ResourceCostInput, ResourceCostEstimate, CostEstimateResult } from "./connectors/index.js";

// IntegrationKit system — composable bundles of tools, connectors, prompts, components
export type { IntegrationKit, ComponentRegistration } from "./kits/index.js";
export { IntegrationKitRegistry, defaultKitRegistry, registerKit } from "./kits/index.js";
export { azureKit } from "./kits/index.js";
export { githubKit } from "./kits/index.js";

// Shared types
export type {
  AzureContext,
  GitHubContext,
  AppDefinition,
  AppRuntime,
  SessionState,
  ConversationMessage,
} from "./types.js";
