import type { Skill } from '../types/skill.js';

/** Approximation: ~4 characters per token. Fail-safe: returns 0 on empty/null/undefined. */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Build a single prompt string from a list of skills. */
export function buildSkillPrompt(skills: Skill[]): string {
  return skills.map((s) => `## ${s.id}\n${s.instructions}`).join('\n\n');
}

/**
 * Greedily select skills that fit within the given token budget.
 * Skills are taken in order; the first skill that would exceed the budget
 * stops iteration.
 */
export function fitSkillsInBudget(skills: Skill[], budgetTokens: number): Skill[] {
  const result: Skill[] = [];
  let used = 0;
  for (const skill of skills) {
    const tokens = estimateTokens(skill.instructions);
    if (used + tokens > budgetTokens) break;
    result.push(skill);
    used += tokens;
  }
  return result;
}
