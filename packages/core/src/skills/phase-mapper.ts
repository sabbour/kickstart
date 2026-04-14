/**
 * @module @kickstart/core/skills/phase-mapper
 *
 * Maps public skill description keywords to Kickstart phases.
 * Uses the same heuristic keyword sets as `classifyPrompt()` in
 * `skill-resolver.ts` to maintain consistency.
 */

import { Phase } from '../engine/types.js';

const DISCOVER_KEYWORDS = [
  'discover', 'detect', 'list', 'find', 'existing', 'query', 'inspect',
  'what language', 'what runtime', 'resource_list',
];

const DESIGN_KEYWORDS = [
  'architecture', 'recommend', 'prefer', 'design', 'database', 'service',
  'plan', 'default', 'configure', 'managed', 'cluster', 'networking',
];

const GENERATE_KEYWORDS = [
  'generat', 'workflow', 'dockerfile', 'manifest', 'artifact', 'ci/cd',
  'pipeline', 'template', 'oidc', 'credential', 'create', 'deploy',
  'yaml', 'helm', 'bicep', 'terraform',
];

const REVIEW_KEYWORDS = [
  'safeguard', 'validation', 'cost', 'estimate', 'security',
  'review', 'budget', 'production', 'audit', 'compliance',
];

/**
 * Classify a text string (typically the SKILL.md `description` field)
 * into a set of Kickstart phases using keyword heuristics.
 *
 * If no keywords match, the skill is considered relevant to ALL phases.
 */
export function classifyToPhases(text: string): Phase[] {
  const lower = text.toLowerCase();
  const matched = new Set<Phase>();

  if (DISCOVER_KEYWORDS.some((kw) => lower.includes(kw))) {
    matched.add(Phase.Discover);
  }
  if (DESIGN_KEYWORDS.some((kw) => lower.includes(kw))) {
    matched.add(Phase.Design);
  }
  if (GENERATE_KEYWORDS.some((kw) => lower.includes(kw))) {
    matched.add(Phase.Generate);
  }
  if (REVIEW_KEYWORDS.some((kw) => lower.includes(kw))) {
    matched.add(Phase.Review);
    matched.add(Phase.Handoff);
    matched.add(Phase.Deploy);
  }

  // If nothing matched, include for all phases (general knowledge)
  if (matched.size === 0) {
    return Object.values(Phase);
  }

  return Array.from(matched);
}

/**
 * Extract activation keywords from a skill description string.
 * Splits on common delimiters and filters to meaningful terms.
 */
export function extractKeywords(description: string): string[] {
  if (!description) return [];

  const words = description
    .toLowerCase()
    .replace(/[.,;:!?()[\]{}'"]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .filter((w) => !STOP_WORDS.has(w));

  // Deduplicate
  return [...new Set(words)];
}

const STOP_WORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'will', 'been', 'they',
  'their', 'about', 'would', 'could', 'should', 'which', 'there',
  'where', 'when', 'what', 'into', 'also', 'more', 'some', 'than',
  'other', 'these', 'those', 'such', 'only', 'then', 'each', 'your',
  'most', 'very', 'just', 'over', 'like', 'make', 'many', 'well',
  'back', 'even', 'them', 'much', 'good', 'know', 'take', 'come',
  'made', 'find', 'here', 'thing', 'does', 'need', 'want', 'give',
  'tell', 'help', 'keep', 'work', 'long', 'must', 'said', 'used',
  'able',
]);
