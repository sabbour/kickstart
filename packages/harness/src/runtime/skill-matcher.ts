import type { Skill } from '../types/skill.js';

/** Shell metacharacters that are forbidden in glob patterns. */
export const FORBIDDEN_PATTERN_RE = /[;|&$`\\]/;

/**
 * Validate an appliesTo glob pattern at registration time.
 * Throws if the pattern contains shell metacharacters.
 */
export function validateGlobPattern(pattern: string): void {
  if (FORBIDDEN_PATTERN_RE.test(pattern)) {
    throw new Error(
      `Glob pattern "${pattern}" contains forbidden shell metacharacters (;|&$\`\\). ` +
        `Reject at registration time to prevent injection.`,
    );
  }
}

/**
 * Returns true if the given agentName matches the skill's appliesTo patterns.
 * An empty or absent appliesTo list means the skill applies to all agents.
 */
export function matchesSkill(agentName: string, skill: Skill): boolean {
  if (!skill.appliesTo || skill.appliesTo.length === 0) return true;
  return skill.appliesTo.some((pattern) => {
    if (pattern === '*') return true; // C1 short-circuit
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`).test(agentName);
  });
}
