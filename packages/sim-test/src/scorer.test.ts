import { describe, it, expect } from 'vitest';
import { scoreSimRun } from './scorer.js';
import type { SimTranscript, ActualOutput } from './types.js';

function makeTranscript(overrides?: Partial<SimTranscript>): SimTranscript {
  return {
    id: 'sim-01',
    title: 'Sam — Next.js greenfield',
    agent: 'core.triage',
    description: 'Test',
    body: '',
    expected: {
      toolCalls: {
        ordered: false,
        required: [{ name: 'core.emit_ui' }, { name: 'core.inspect_repo' }],
      },
      recipes: { required: ['R1', 'R17'] },
      questionBudget: { max: 0 },
      behaviors: [
        { id: 'zero-questions', description: 'Routes without questions' },
        { id: 'r17-close', description: 'R17 close fires' },
      ],
    },
    ...overrides,
  };
}

function makePerfectActual(): ActualOutput {
  return {
    toolCalls: [
      { name: 'core.inspect_repo', index: 0 },
      { name: 'core.emit_ui', index: 1 },
    ],
    recipesEmitted: [{ recipeId: 'R1' }, { recipeId: 'R17' }],
    questionCount: 0,
    behaviorsObserved: ['zero-questions', 'r17-close'],
  };
}

describe('scoreSimRun()', () => {
  it('scores a perfect run as 100 overall and all criteria pass', () => {
    const score = scoreSimRun(makeTranscript(), makePerfectActual());
    expect(score.overallScore).toBe(100);
    expect(score.pass).toBe(true);
    for (const criterion of score.criteria) {
      expect(criterion.score).toBe(100);
      expect(criterion.pass).toBe(true);
    }
  });

  it('simId and agentId are propagated from the transcript', () => {
    const score = scoreSimRun(makeTranscript(), makePerfectActual());
    expect(score.simId).toBe('sim-01');
    expect(score.agentId).toBe('core.triage');
  });

  it('penalises missing tool calls proportionally', () => {
    const actual: ActualOutput = {
      ...makePerfectActual(),
      toolCalls: [{ name: 'core.emit_ui', index: 0 }], // only 1 of 2
    };
    const score = scoreSimRun(makeTranscript(), actual);
    const tc = score.criteria.find((c) => c.name === 'toolCalls')!;
    expect(tc.score).toBe(50); // 1/2 present
    expect(tc.pass).toBe(false);
    expect(score.overallScore).toBeLessThan(100);
  });

  it('gives 0 to tool calls criterion when none are called', () => {
    const actual: ActualOutput = { ...makePerfectActual(), toolCalls: [] };
    const score = scoreSimRun(makeTranscript(), actual);
    const tc = score.criteria.find((c) => c.name === 'toolCalls')!;
    expect(tc.score).toBe(0);
    expect(tc.pass).toBe(false);
  });

  it('penalises missing recipes proportionally', () => {
    const actual: ActualOutput = {
      ...makePerfectActual(),
      recipesEmitted: [{ recipeId: 'R1' }], // only 1 of 2
    };
    const score = scoreSimRun(makeTranscript(), actual);
    const rc = score.criteria.find((c) => c.name === 'recipes')!;
    expect(rc.score).toBe(50);
    expect(rc.pass).toBe(false);
  });

  it('fails question budget when agent exceeds max', () => {
    const actual: ActualOutput = { ...makePerfectActual(), questionCount: 2 };
    const score = scoreSimRun(makeTranscript(), actual);
    const qb = score.criteria.find((c) => c.name === 'questionBudget')!;
    expect(qb.score).toBeLessThan(100);
    expect(qb.pass).toBe(false);
  });

  it('passes question budget exactly at max', () => {
    const transcript = makeTranscript({
      expected: {
        ...makeTranscript().expected,
        questionBudget: { max: 2 },
      },
    });
    const actual: ActualOutput = { ...makePerfectActual(), questionCount: 2 };
    const score = scoreSimRun(transcript, actual);
    const qb = score.criteria.find((c) => c.name === 'questionBudget')!;
    expect(qb.score).toBe(100);
    expect(qb.pass).toBe(true);
  });

  it('penalises missing behaviours proportionally', () => {
    const actual: ActualOutput = {
      ...makePerfectActual(),
      behaviorsObserved: ['zero-questions'], // only 1 of 2
    };
    const score = scoreSimRun(makeTranscript(), actual);
    const bv = score.criteria.find((c) => c.name === 'behaviors')!;
    expect(bv.score).toBe(50);
    expect(bv.pass).toBe(false);
  });

  it('overall score is a weighted average of criteria scores', () => {
    // tool(20)=50, recipes(40)=100, budget(20)=100, behaviors(20)=100
    // => (50*20 + 100*40 + 100*20 + 100*20) / 100 = (1000+4000+2000+2000)/100 = 90
    const actual: ActualOutput = {
      ...makePerfectActual(),
      toolCalls: [{ name: 'core.emit_ui', index: 0 }], // 1 of 2 = 50
    };
    const score = scoreSimRun(makeTranscript(), actual);
    expect(score.overallScore).toBe(90);
  });

  it('respects custom weights from the transcript', () => {
    const transcript = makeTranscript({
      expected: {
        ...makeTranscript().expected,
        weights: { toolCalls: 0, recipes: 100, questionBudget: 0, behaviors: 0 },
      },
    });
    // Missing both tool calls but recipes perfect → should still be 100 because toolCalls weight=0
    const actual: ActualOutput = { ...makePerfectActual(), toolCalls: [] };
    const score = scoreSimRun(transcript, actual);
    expect(score.overallScore).toBe(100);
  });

  it('skips criteria with no required items (score=100, weight unchanged)', () => {
    const transcript = makeTranscript({
      expected: {
        toolCalls: { ordered: false, required: [] },
        recipes: { required: [] },
        questionBudget: { max: 3 },
        behaviors: [],
      },
    });
    const actual: ActualOutput = {
      toolCalls: [],
      recipesEmitted: [],
      questionCount: 0,
      behaviorsObserved: [],
    };
    const score = scoreSimRun(transcript, actual);
    expect(score.overallScore).toBe(100);
    expect(score.pass).toBe(true);
  });

  it('detects ordered tool-call violations', () => {
    const transcript = makeTranscript({
      expected: {
        ...makeTranscript().expected,
        toolCalls: {
          ordered: true,
          required: [
            { name: 'core.inspect_repo', order: 0 },
            { name: 'core.emit_ui', order: 1 },
          ],
        },
      },
    });
    // actual has them reversed
    const actual: ActualOutput = {
      ...makePerfectActual(),
      toolCalls: [
        { name: 'core.emit_ui', index: 0 },
        { name: 'core.inspect_repo', index: 1 },
      ],
    };
    const score = scoreSimRun(transcript, actual);
    const tc = score.criteria.find((c) => c.name === 'toolCalls')!;
    expect(tc.score).toBeLessThan(100);
  });

  it('detects ordered violations when tools lack explicit order fields (falls back to array position)', () => {
    // ordered: true but no explicit `order` fields — array position is the contract
    const transcript = makeTranscript({
      expected: {
        ...makeTranscript().expected,
        toolCalls: {
          ordered: true,
          required: [
            { name: 'core.inspect_repo' }, // implied order: 0
            { name: 'core.emit_ui' },       // implied order: 1
          ],
        },
      },
    });
    // actual has them reversed — should be penalised
    const actual: ActualOutput = {
      ...makePerfectActual(),
      toolCalls: [
        { name: 'core.emit_ui', index: 0 },
        { name: 'core.inspect_repo', index: 1 },
      ],
    };
    const score = scoreSimRun(transcript, actual);
    const tc = score.criteria.find((c) => c.name === 'toolCalls')!;
    expect(tc.score).toBeLessThan(100);
  });

  it('returns 4 criteria in the result', () => {
    const score = scoreSimRun(makeTranscript(), makePerfectActual());
    expect(score.criteria).toHaveLength(4);
    const names = score.criteria.map((c) => c.name);
    expect(names).toContain('toolCalls');
    expect(names).toContain('recipes');
    expect(names).toContain('questionBudget');
    expect(names).toContain('behaviors');
  });

  it('includes weight on each criterion', () => {
    const score = scoreSimRun(makeTranscript(), makePerfectActual());
    const tc = score.criteria.find((c) => c.name === 'toolCalls')!;
    expect(tc.weight).toBe(20);
    const rc = score.criteria.find((c) => c.name === 'recipes')!;
    expect(rc.weight).toBe(40);
  });
});
