/**
 * @module @kickstart/core/engine/types
 *
 * Types for the conversation state machine.
 */

/** Conversation phases in the Kickstart guided flow. */
export enum Phase {
  /** Understand what the user wants to build */
  Understand = "understand",
  /** Clarify requirements and fill gaps */
  Clarify = "clarify",
  /** Determine Azure resource needs */
  Needs = "needs",
  /** Generate deployment plan and artifacts */
  Plan = "plan",
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
