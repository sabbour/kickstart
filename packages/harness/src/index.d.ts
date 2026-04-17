export declare const Phase: {
    readonly Discover: "discover";
    readonly Assess: "assess";
    readonly Design: "design";
    readonly Generate: "generate";
    readonly Review: "review";
    readonly Deploy: "deploy";
};
export type Phase = (typeof Phase)[keyof typeof Phase];
export type PhaseItem = Record<string, unknown>;
export type A2UIMessage = Record<string, unknown>;
export type A2UIDocument = Record<string, unknown>;
export type ChatMessage = Record<string, unknown>;
export type ConversationMessage = Record<string, unknown>;
export type CostEstimateProps = Record<string, unknown>;
export type Artifact = Record<string, unknown>;
export type ArtifactStore = Record<string, unknown>;
export type AzureARMConnector = Record<string, unknown>;
export type AzureSubscription = Record<string, unknown>;
export type AzureLocation = Record<string, unknown>;
export type AzureContext = Record<string, unknown>;
export type GitHubConnector = Record<string, unknown>;
export type GitHubRepo = Record<string, unknown>;
export type GitHubPullRequest = Record<string, unknown>;
export type APIConnector = Record<string, unknown>;
export type APIConnectorRegistry = Record<string, unknown>;
export type OpenAIToolDefinition = Record<string, unknown>;
export type ToolCall = Record<string, unknown>;
export type ToolContext = Record<string, unknown>;
export type ConversationSkillsContext = Record<string, unknown>;
export type SessionState = Record<string, unknown>;
export type Component = Record<string, unknown>;
export type CardComponent = Record<string, unknown>;
export type ColumnComponent = Record<string, unknown>;
export type TextComponent = Record<string, unknown>;
export type SetupGenerationRunState = Record<string, unknown>;
export type SetupGenerationSnapshot = Record<string, unknown>;
export type SetupGenerationStepId = string;
export type SetupGenerationStepState = Record<string, unknown>;
export declare class InMemoryArtifactStore {
}
export declare const KNOWN_COMPONENT_TYPES: string[];
export declare const SETUP_GENERATION_STEP_ORDER: string[];
export declare function registerKit(_kit: unknown): void;
export declare const azureKit: unknown;
export declare const githubKit: unknown;
export declare function buildSystemPrompt(_opts: unknown): string;
export declare function resolveSkills(_phase: unknown, _skills: unknown[]): unknown[];
export declare function resolveConversationSkills(_ctx: unknown): unknown[];
export declare function processResponse(_text: string): unknown;
export declare function getPhaseDefinition(_phase: unknown): {
    label: string;
};
export declare function getPhaseOrder(): Phase[];
export declare function isPhase(value: unknown): value is Phase;
export declare const defaultKitRegistry: {
    getAll(): unknown[];
};
export declare const defaultRegistry: {
    toOpenAIFormat(): unknown[];
    get(_name: string): unknown;
};
export declare class PricingConnector {
    constructor(..._args: unknown[]);
    getPricing(_opts: unknown): Promise<unknown>;
}
//# sourceMappingURL=index.d.ts.map