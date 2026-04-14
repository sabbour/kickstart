/**
 * @module @kickstart/core/skills/frontmatter-parser
 *
 * Minimal YAML frontmatter parser for public SKILL.md files.
 *
 * Handles the simple key-value YAML used in Copilot skill repos
 * (name, description, license, metadata block). No external YAML
 * library required — the frontmatter format is constrained.
 */

import type { ParsedSkillMd, SkillFrontmatter } from './types.js';

/**
 * Parse a SKILL.md file into frontmatter + body.
 *
 * Expected format:
 * ```
 * ---
 * name: skill-name
 * description: "A description"
 * license: MIT
 * metadata:
 *   author: Someone
 *   version: "1.0.0"
 * ---
 * # Markdown body here
 * ```
 *
 * @throws Error if frontmatter delimiters are missing or name is absent
 */
export function parseSkillMd(raw: string): ParsedSkillMd {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    throw new Error(
      'Invalid SKILL.md format: missing YAML frontmatter delimiters (--- ... ---)',
    );
  }

  const [, yamlBlock, body] = match;
  const frontmatter = parseSimpleYaml(yamlBlock);

  if (!frontmatter.name || typeof frontmatter.name !== 'string') {
    throw new Error(
      'Invalid SKILL.md frontmatter: "name" field is required and must be a string',
    );
  }

  return {
    frontmatter: frontmatter as SkillFrontmatter,
    body: body.trim(),
  };
}

/**
 * Minimal YAML parser for SKILL.md frontmatter.
 * Supports: string values (plain and quoted), nested objects (one level).
 * Does NOT support: arrays, multi-line strings, anchors, etc.
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');

  let currentKey: string | null = null;
  let currentNested: Record<string, unknown> | null = null;

  for (const line of lines) {
    // Skip empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    // Nested key-value (indented with spaces)
    const nestedMatch = line.match(/^  +(\w[\w.-]*)\s*:\s*(.*)$/);
    if (nestedMatch && currentKey) {
      if (!currentNested) {
        currentNested = {};
        result[currentKey] = currentNested;
      }
      currentNested[nestedMatch[1]] = unquote(nestedMatch[2].trim());
      continue;
    }

    // Top-level key-value
    const topMatch = line.match(/^(\w[\w.-]*)\s*:\s*(.*)$/);
    if (topMatch) {
      // Flush any pending nested object
      if (currentKey && currentNested) {
        result[currentKey] = currentNested;
      }

      currentKey = topMatch[1];
      const value = topMatch[2].trim();

      if (value === '') {
        // Start of a nested object
        currentNested = {};
        result[currentKey] = currentNested;
      } else {
        currentNested = null;
        result[currentKey] = unquote(value);
      }
    }
  }

  return result;
}

/** Remove surrounding quotes from a YAML string value. */
function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}
