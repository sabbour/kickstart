/**
 * Match scorer for sim-as-regression-test.
 *
 * Compares an ActualOutput against the expected criteria from a SimTranscript
 * and produces a per-criterion breakdown plus an overall 0–100 score.
 *
 * Scoring dimensions:
 *   1. toolCalls   — were all required tools called? In the right order?
 *   2. recipes     — were all required recipes emitted?
 *   3. questionBudget — did the agent stay within the question cap?
 *   4. behaviors   — were all required behaviour flags observed?
 *
 * Each dimension scores 0–100; the final score is a weighted average.
 * Default weights: toolCalls=20, recipes=40, questionBudget=20, behaviors=20.
 */

import type {
  SimTranscript,
  ActualOutput,
  SimScore,
  CriterionScore,
  ScoreWeights,
} from './types.js';

const DEFAULT_WEIGHTS: ScoreWeights = {
  toolCalls: 20,
  recipes: 40,
  questionBudget: 20,
  behaviors: 20,
};

const PASS_THRESHOLD = 70;

function resolveWeights(partial?: Partial<ScoreWeights>): ScoreWeights {
  return {
    toolCalls: partial?.toolCalls ?? DEFAULT_WEIGHTS.toolCalls,
    recipes: partial?.recipes ?? DEFAULT_WEIGHTS.recipes,
    questionBudget: partial?.questionBudget ?? DEFAULT_WEIGHTS.questionBudget,
    behaviors: partial?.behaviors ?? DEFAULT_WEIGHTS.behaviors,
  };
}

/** Score tool-call criterion (0–100). */
function scoreToolCalls(
  transcript: SimTranscript,
  actual: ActualOutput,
): CriterionScore {
  const { required, ordered } = transcript.expected.toolCalls;

  if (required.length === 0) {
    return {
      name: 'toolCalls',
      score: 100,
      pass: true,
      weight: 0,
      details: 'No required tool calls specified — criterion skipped.',
    };
  }

  const actualNames = actual.toolCalls.map((tc) => tc.name);
  const missing: string[] = [];
  const present: string[] = [];

  for (const req of required) {
    if (actualNames.includes(req.name)) {
      present.push(req.name);
    } else {
      missing.push(req.name);
    }
  }

  const presenceScore = required.length > 0
    ? Math.round((present.length / required.length) * 100)
    : 100;

  let orderPenalty = 0;
  let orderDetails = '';

  if (ordered && missing.length === 0) {
    // Build the ordered sequence to check: use explicit `order` fields when present,
    // falling back to array position so that `ordered: true` without explicit indices
    // still enforces the declaration order in the `required` array.
    const ordered_required = required
      .map((r, i) => ({ name: r.name, order: r.order ?? i }))
      .sort((a, b) => a.order - b.order);

    if (ordered_required.length >= 2) {
      const indices = ordered_required.map((r) => actualNames.indexOf(r.name));
      let outOfOrder = 0;
      for (let i = 1; i < indices.length; i++) {
        if (indices[i] < indices[i - 1]) outOfOrder++;
      }
      if (outOfOrder > 0) {
        orderPenalty = Math.round((outOfOrder / (ordered_required.length - 1)) * 20);
        orderDetails = ` ${outOfOrder} tool(s) out of order (-${orderPenalty}pts).`;
      }
    }
  }

  const score = Math.max(0, presenceScore - orderPenalty);
  const details = missing.length === 0
    ? `All ${required.length} required tool(s) called.${orderDetails}`
    : `Missing: ${missing.join(', ')}. Present: ${present.join(', ') || '(none)'}.`;

  return {
    name: 'toolCalls',
    score,
    pass: score >= PASS_THRESHOLD,
    weight: 0,
    details,
  };
}

/** Score recipe-emission criterion (0–100). */
function scoreRecipes(
  transcript: SimTranscript,
  actual: ActualOutput,
): CriterionScore {
  const required = transcript.expected.recipes.required;

  if (required.length === 0) {
    return {
      name: 'recipes',
      score: 100,
      pass: true,
      weight: 0,
      details: 'No required recipes specified — criterion skipped.',
    };
  }

  const emittedIds = actual.recipesEmitted.map((r) => r.recipeId);
  const missing = required.filter((r) => !emittedIds.includes(r));
  const present = required.filter((r) => emittedIds.includes(r));

  const score = Math.round((present.length / required.length) * 100);
  const details = missing.length === 0
    ? `All ${required.length} required recipe(s) emitted: ${present.join(', ')}.`
    : `Missing: ${missing.join(', ')}. Present: ${present.join(', ') || '(none)'}.`;

  return {
    name: 'recipes',
    score,
    pass: score >= PASS_THRESHOLD,
    weight: 0,
    details,
  };
}

/** Score question-budget criterion (0–100). */
function scoreQuestionBudget(
  transcript: SimTranscript,
  actual: ActualOutput,
): CriterionScore {
  const { max } = transcript.expected.questionBudget;
  const actual_count = actual.questionCount;

  if (actual_count <= max) {
    return {
      name: 'questionBudget',
      score: 100,
      pass: true,
      weight: 0,
      details: `${actual_count} question(s) asked; budget is ≤${max}.`,
    };
  }

  // Penalty: proportional to overshoot, capped at 100
  const overshoot = actual_count - max;
  const penalty = Math.min(100, Math.round((overshoot / Math.max(1, max + 1)) * 100));
  const score = Math.max(0, 100 - penalty);

  return {
    name: 'questionBudget',
    score,
    pass: false,
    weight: 0,
    details: `${actual_count} question(s) asked; budget is ≤${max} (over by ${overshoot}).`,
  };
}

/** Score behaviour-flags criterion (0–100). */
function scoreBehaviors(
  transcript: SimTranscript,
  actual: ActualOutput,
): CriterionScore {
  const required = transcript.expected.behaviors;

  if (required.length === 0) {
    return {
      name: 'behaviors',
      score: 100,
      pass: true,
      weight: 0,
      details: 'No required behaviours specified — criterion skipped.',
    };
  }

  const missing = required.filter((b) => !actual.behaviorsObserved.includes(b.id));
  const present = required.filter((b) => actual.behaviorsObserved.includes(b.id));

  const score = Math.round((present.length / required.length) * 100);
  const details = missing.length === 0
    ? `All ${required.length} behaviour(s) observed: ${present.map((b) => b.id).join(', ')}.`
    : `Missing: ${missing.map((b) => b.id).join(', ')}. Present: ${present.map((b) => b.id).join(', ') || '(none)'}.`;

  return {
    name: 'behaviors',
    score,
    pass: score >= PASS_THRESHOLD,
    weight: 0,
    details,
  };
}

/**
 * Score an actual agent output against a sim transcript's expected criteria.
 * Returns a SimScore with per-criterion breakdown and an overall 0–100 score.
 */
export function scoreSimRun(
  transcript: SimTranscript,
  actual: ActualOutput,
): SimScore {
  const weights = resolveWeights(transcript.expected.weights);

  const toolCallsCriterion = scoreToolCalls(transcript, actual);
  const recipesCriterion = scoreRecipes(transcript, actual);
  const questionBudgetCriterion = scoreQuestionBudget(transcript, actual);
  const behaviorsCriterion = scoreBehaviors(transcript, actual);

  toolCallsCriterion.weight = weights.toolCalls;
  recipesCriterion.weight = weights.recipes;
  questionBudgetCriterion.weight = weights.questionBudget;
  behaviorsCriterion.weight = weights.behaviors;

  const totalWeight = weights.toolCalls + weights.recipes + weights.questionBudget + weights.behaviors;
  const weightedSum =
    toolCallsCriterion.score * weights.toolCalls +
    recipesCriterion.score * weights.recipes +
    questionBudgetCriterion.score * weights.questionBudget +
    behaviorsCriterion.score * weights.behaviors;

  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const criteria = [
    toolCallsCriterion,
    recipesCriterion,
    questionBudgetCriterion,
    behaviorsCriterion,
  ];

  return {
    simId: transcript.id,
    agentId: transcript.agent,
    overallScore,
    pass: overallScore >= PASS_THRESHOLD,
    criteria,
  };
}
