/**
 * @module @kickstart/core/types
 *
 * Shared types across the Kickstart platform.
 */

/** Azure subscription and resource context for a deployment. */
export interface AzureContext {
  subscriptionId: string;
  resourceGroup: string;
  region: string;
  clusterName?: string;
  tenantId: string;
}

/** GitHub repository context for code generation and handoff. */
export interface GitHubContext {
  owner: string;
  repo: string;
  branch: string;
  /** Full URL: https://github.com/{owner}/{repo} */
  repoUrl: string;
}

/** Application type that Kickstart can generate artifacts for. */
export type AppRuntime =
  | "node"
  | "python"
  | "dotnet"
  | "java"
  | "go"
  | "rust"
  | "static";

/** Describes the user's application as understood through conversation. */
export interface AppDefinition {
  /** Human-readable name of the application */
  name: string;
  /** Brief description of what it does */
  description: string;
  /** Primary runtime/language */
  runtime: AppRuntime;
  /** Port the application listens on */
  port: number;
  /** Whether the app needs a database */
  needsDatabase: boolean;
  /** Database type if needed */
  databaseType?: "postgres" | "mysql" | "mongodb" | "redis" | "cosmosdb";
  /** Whether the app needs ingress (public endpoint) */
  needsIngress: boolean;
  /** Custom domain if provided */
  customDomain?: string;
  /** Environment variables the app requires (names only, not values) */
  envVars: string[];
  /** Estimated resource tier */
  resourceTier: "dev" | "standard" | "production";
}

/** Conversation session state persisted across tool calls. */
export interface SessionState {
  /** Unique session identifier */
  sessionId: string;
  /** Current conversation phase */
  currentPhase: string;
  /** Timestamp of session creation */
  createdAt: string;
  /** Timestamp of last interaction */
  updatedAt: string;
  /** Accumulated app definition from conversation */
  appDefinition: Partial<AppDefinition>;
  /** Azure context if provided */
  azureContext?: Partial<AzureContext>;
  /** GitHub context if provided */
  githubContext?: Partial<GitHubContext>;
  /** Raw conversation messages for LLM context */
  messages: ConversationMessage[];
}

/** A single message in the conversation history. */
export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}
