/**
 * @module @kickstart/core/skills/knowledge-extractor
 *
 * Transforms raw SKILL.md markdown body into structured knowledge facts.
 * This is the core defense against prompt injection — the LLM never
 * sees raw third-party prose, only extracted factual statements.
 *
 * Extraction rules:
 * - Keep declarative/factual sentences
 * - Strip imperative commands ("Do X", "Always Y")
 * - Strip question-as-commands ("Can you...?")
 * - Limit output to structured fields only
 */

import type { SkillFrontmatter } from './types.js';

/**
 * Extract factual knowledge statements from a markdown body.
 * Returns only declarative sentences — strips imperatives and commands.
 */
export function extractKnowledgeFacts(body: string): string[] {
  const facts: string[] = [];

  // Split into lines and process
  const lines = body.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines, headers, list markers-only, code fences, HTML
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    if (trimmed === '-' || trimmed === '*') continue;
    if (trimmed.startsWith('```')) continue;
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) continue;

    // Remove markdown list markers
    const cleaned = trimmed.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');
    if (!cleaned || cleaned.length < 10) continue;

    // Skip imperative sentences (start with verb)
    if (isImperative(cleaned)) continue;

    // Skip question-as-command patterns
    if (cleaned.endsWith('?')) continue;

    // Keep factual/declarative content
    facts.push(cleaned);
  }

  return facts;
}

/**
 * Extract supported question patterns from frontmatter description.
 */
export function extractQuestionPatterns(
  frontmatter: SkillFrontmatter,
  body: string,
): string[] {
  const patterns: string[] = [];

  // From description field
  if (frontmatter.description) {
    patterns.push(frontmatter.description);
  }

  // From "When to Use" sections in the body
  const whenSection = extractSection(body, 'When to Use');
  if (whenSection) {
    const bullets = whenSection
      .split('\n')
      .map((l) => l.trim().replace(/^[-*+]\s+/, ''))
      .filter((l) => l.length > 10);
    patterns.push(...bullets);
  }

  return patterns;
}

/**
 * Extract a named section from markdown (content between ## headings).
 * Supports partial matching — "When to Use" matches "## When to Use This Skill".
 */
function extractSection(body: string, sectionName: string): string | null {
  const lines = body.split('\n');
  let capturing = false;
  const sectionLines: string[] = [];
  const lowerName = sectionName.toLowerCase();

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (capturing) break; // Hit next section
      if (line.toLowerCase().includes(lowerName)) {
        capturing = true;
        continue;
      }
    }
    if (capturing) {
      sectionLines.push(line);
    }
  }

  const result = sectionLines.join('\n').trim();
  return result || null;
}

/** Common imperative verb starters indicating commands, not facts. */
const IMPERATIVE_STARTERS = [
  /^(always|never|do\s+not|don't|ensure|make\s+sure|verify|check|use|set|run|execute|call|create|delete|remove|add|update|install|configure|enable|disable|start|stop|open|close|read|write|send|receive|follow|avoid|prefer|consider|remember|note\s+that)\b/i,
];

function isImperative(sentence: string): boolean {
  return IMPERATIVE_STARTERS.some((p) => p.test(sentence));
}
