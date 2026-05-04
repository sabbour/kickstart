/**
 * Types for the sim-as-regression-test harness.
 *
 * A SimTranscript is the golden fixture: it captures the expected
 * agent behaviours for a named scenario. The ActualOutput is the
 * recorded agent response that the scorer compares against the fixture.
 */

export interface ExpectedToolCall {
  /** Tool name, e.g. "core.emit_ui" */
  name: string;
  /** Optional positional order index (only used when toolCalls.ordered = true) */
  order?: number;
}

export interface ExpectedBehavior {
  /** Short identifier, e.g. "zero-questions" or "r17-close" */
  id: string;
  /** Human-readable description of the behaviour */
  description: string;
}

export interface ToolCallExpectation {
  /** When true, required tools must appear in the listed order */
  ordered: boolean;
  required: ExpectedToolCall[];
}

export interface RecipeExpectation {
  /** Recipe IDs that must be emitted, e.g. ["R1", "R17"] */
  required: string[];
}

export interface QuestionBudgetExpectation {
  /** Maximum number of questions the agent is allowed to ask */
  max: number;
}

export interface ScoreWeights {
  toolCalls: number;
  recipes: number;
  questionBudget: number;
  behaviors: number;
}

export interface SimExpected {
  toolCalls: ToolCallExpectation;
  recipes: RecipeExpectation;
  questionBudget: QuestionBudgetExpectation;
  behaviors: ExpectedBehavior[];
  /**
   * Scoring weights (must sum to 100).
   * Defaults: toolCalls=20, recipes=40, questionBudget=20, behaviors=20
   */
  weights?: Partial<ScoreWeights>;
}

/** Parsed representation of a sim transcript .md file */
export interface SimTranscript {
  /** Fixture ID, e.g. "sim-01" */
  id: string;
  /** Human-readable title */
  title: string;
  /** Target agent identifier, e.g. "core.triage" */
  agent: string;
  /** Short scenario description */
  description: string;
  /** Expected outcomes */
  expected: SimExpected;
  /** Raw markdown body (scenario prose) */
  body: string;
}

/** A single recorded tool call from an actual agent run */
export interface ActualToolCall {
  name: string;
  /** Zero-based position in the run sequence */
  index: number;
}

/** A single recipe emission recorded from an actual agent run */
export interface ActualRecipeEmission {
  recipeId: string;
}

/** Actual output produced by an agent run (or pre-recorded for golden fixtures) */
export interface ActualOutput {
  toolCalls: ActualToolCall[];
  recipesEmitted: ActualRecipeEmission[];
  /** Number of questions the agent asked */
  questionCount: number;
  /** Behaviour flags present in this run */
  behaviorsObserved: string[];
}

/** Per-criterion score (0–100) with pass/fail and details */
export interface CriterionScore {
  name: string;
  score: number;
  pass: boolean;
  weight: number;
  details: string;
}

/** Full scoring result for a sim run */
export interface SimScore {
  simId: string;
  agentId: string;
  overallScore: number;
  pass: boolean;
  criteria: CriterionScore[];
}
