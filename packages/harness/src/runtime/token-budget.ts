import type { Skill } from '../types/skill.js';

/** Approximation: ~4 characters per token. Fail-safe: returns 0 on empty/null/undefined. */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Build a single prompt string from a list of skills. */
export function buildSkillPrompt(skills: Skill[]): string {
  return skills.map((s) => `<skill name="${s.id}">\n${s.instructions}\n</skill>`).join('\n');
}

/**
 * Greedily select skills that fit within the given token budget.
 * Each skill is costed as its fully-rendered block (header + instructions).
 * Oversized skills are skipped (continue) so later smaller skills can still fit.
 */
export function fitSkillsInBudget(skills: Skill[], budgetTokens: number): Skill[] {
  const result: Skill[] = [];
  let used = 0;
  for (const skill of skills) {
    const rendered = buildSkillPrompt([skill]);
    const tokens = estimateTokens(rendered);
    if (used + tokens > budgetTokens) continue; // SKIP oversized, not break
    result.push(skill);
    used += tokens;
  }
  return result;
}
