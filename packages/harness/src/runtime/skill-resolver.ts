import type { Skill } from '../types/skill.js';
import { fitSkillsInBudget } from './token-budget.js';
import { matchesSkill } from './skill-matcher.js';

export interface ResolveSkillsOptions {
  agentName: string;
  userMessage: string;
  budgetTokens: number;
}

/**
 * Resolves the ordered, budget-trimmed list of skills for a given agent and user message.
 *
 * Pipeline:
 *   1. Filter by appliesTo (matchesSkill)
 *   2. Keyword scoring — count how many of skill.keywords[] appear in userMessage (case-insensitive)
 *   3. Sort by score DESC, then priority ASC (lower number = higher priority)
 *   4. Fit to token budget (fitSkillsInBudget)
 */
export function resolveSkills(skills: Skill[], opts: ResolveSkillsOptions): Skill[] {
  // Stage 1: filter by appliesTo
  const applicable = skills.filter(s => matchesSkill(opts.agentName, s));

  // Stage 2: keyword scoring
  const msg = opts.userMessage.toLowerCase();
  const scored = applicable.map(skill => {
    const score = (skill.keywords ?? []).filter(kw => msg.includes(kw.toLowerCase())).length;
    return { skill, score };
  });

  // Stage 3: sort by score DESC, priority ASC
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.skill.priority ?? 999) - (b.skill.priority ?? 999);
  });

  const sorted = scored.map(({ skill }) => skill);

  // Stage 4: fit to budget
  return fitSkillsInBudget(sorted, opts.budgetTokens);
}
