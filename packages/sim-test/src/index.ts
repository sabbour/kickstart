/**
 * Public API for @aks-kickstart/sim-test
 */
export { parseSimTranscript, parseSimTranscriptFile, SimParseError } from './parser.js';
export { scoreSimRun } from './scorer.js';
export { SimRecorder } from './recorder.js';
export type {
  SimTranscript,
  SimExpected,
  ActualOutput,
  ActualToolCall,
  ActualRecipeEmission,
  SimScore,
  CriterionScore,
  ExpectedBehavior,
  ExpectedToolCall,
  QuestionBudgetExpectation,
  RecipeExpectation,
  ScoreWeights,
  ToolCallExpectation,
} from './types.js';
