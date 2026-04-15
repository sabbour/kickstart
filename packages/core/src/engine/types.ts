/**
 * @module @kickstart/core/engine/types
 *
 * Types for the conversation state machine.
 */

/** Conversation phases in the Kickstart guided flow. */
export enum Phase {
  /** What is the app? Language/framework? Existing code? */
  Discover = "discover",
  /** What services needed? Architecture diagram */
  Design = "design",
  /** Create all deployment artifacts */
  Generate = "generate",
  /** Validate manifests, show cost estimate */
  Review = "review",
  /** Get the generated project into GitHub. */
  Handoff = "handoff",
  /** Guide the Azure deployment flow to a real running app. */
  Deploy = "deploy",
}

/** Status of a conversation phase. */
export type PhaseStatus = "pending" | "active" | "complete" | "skipped";

/** Tracks the state of the conversation across phases. */
export interface ConversationState {
  /** Current active phase */
  currentPhase: Phase;
  /** Status of each phase */
  phaseStatus: Record<Phase, PhaseStatus>;
  /** Data collected during each phase */
  phaseData: Record<Phase, Record<string, unknown>>;
  /** Whether the conversation is complete */
  isComplete: boolean;
}

/** Definition of a conversation phase with its behavior. */
export interface PhaseDefinition {
  /** Phase identifier */
  id: Phase;
  /** Human-readable label */
  label: string;
  /** Description shown to the user */
  description: string;
  /** Conditions that must be true to enter this phase */
  entryConditions: string[];
  /** Conditions that must be true to exit this phase */
  exitConditions: string[];
  /** LLM system prompt template for this phase */
  promptTemplate: string;
  /** Next phase after this one completes */
  nextPhase: Phase | null;
}

/** Events that drive the conversation state machine. */
export type ConversationEvent =
  | { type: "START" }
  | { type: "ADVANCE"; data?: Record<string, unknown> }
  | { type: "SKIP" }
  | { type: "RESET" }
  | { type: "USER_INPUT"; input: string }
  | { type: "PHASE_COMPLETE"; phase: Phase; data: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Knowledge Skills (#33)
// ---------------------------------------------------------------------------

/** A discrete unit of domain knowledge injectable into the system prompt. */
export interface Skill {
  /** Unique skill identifier, e.g. "iac-bicep-modules" */
  id: string;
  /** Human-readable name */
  name: string;
  /** Phases where this skill is relevant */
  phases: Phase[];
  /** Keywords that trigger this skill when found in conversation context */
  keywords: string[];
  /** The prompt content to inject */
  content: string;
  /** Priority — higher = injected first (default: 0) */
  priority?: number;
}

/** Context passed through the skill resolver middleware chain. */
export interface SkillResolverContext {
  kits: import("../kits/types.js").IntegrationKit[];
  conversationHistory?: string[];
  activeSkillIds?: Set<string>;
}
