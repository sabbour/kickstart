/**
 * Prompt-text regression guard for the one-question-at-a-time triage policy
 * introduced in #110.
 *
 * Does not invoke the LLM — just reads the .agent.md file and asserts that
 * the key behavioral instructions are present so they can't quietly disappear
 * in a future edit.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TRIAGE_PATH = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'pack-core',
  'src',
  'agents',
  'triage.agent.md',
);

describe('triage.agent.md — one-question-at-a-time policy (#110)', () => {
  const body = readFileSync(TRIAGE_PATH, 'utf-8');

  it('has a Requirements Gathering Policy section', () => {
    // The requirements gathering guidance now lives under this expanded section heading.
    expect(body).toContain('## Posture & Requirements Gathering Policy');
  });

  it('instructs the agent to ask one question per turn', () => {
    const hasOneQ =
      /ask one question per turn/i.test(body) ||
      /never ask more than one question/i.test(body);
    expect(hasOneQ).toBe(true);
  });

  it('defines a hard cap of 3 questions before forced routing', () => {
    const hasCap =
      /maximum 3 questions/i.test(body) ||
      /hard cap.*3/i.test(body) ||
      /3 questions.*forced routing/i.test(body);
    expect(hasCap).toBe(true);
  });

  it('allows routing after 0 questions when intent is clear', () => {
    const hasZeroQ =
      /after 0\b/i.test(body) ||
      /0 question/i.test(body) ||
      /route immediately/i.test(body);
    expect(hasZeroQ).toBe(true);
  });

  it('instructs re-evaluation after each answer', () => {
    const hasReeval =
      /re-evaluate.*after each answer/i.test(body) ||
      /after each.*answer.*re-evaluate/i.test(body) ||
      /re-evaluate whether you have enough/i.test(body);
    expect(hasReeval).toBe(true);
  });

  it('does not instruct emitting a multi-field Questionnaire for repo_uplift', () => {
    // The old form-dump pattern: emit a Questionnaire with all questions at once
    expect(body).not.toMatch(
      /emit a `Questionnaire`.*with those questions.*onSubmit.*repo_uplift_answers/s,
    );
  });
});
