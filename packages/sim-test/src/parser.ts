/**
 * Sim transcript parser.
 *
 * Reads a sim .md file with YAML frontmatter and extracts the expected
 * criteria (tool calls, recipes, question budget, behaviours) into a
 * strongly-typed SimTranscript object.
 *
 * Frontmatter schema:
 *
 * ```yaml
 * sim: sim-01
 * title: "Sam — Next.js greenfield (floor case)"
 * agent: core.triage
 * description: "..."
 * expected:
 *   toolCalls:
 *     ordered: false
 *     required:
 *       - name: core.emit_ui
 *   recipes:
 *     required: [R1, R17]
 *   questionBudget:
 *     max: 0
 *   behaviors:
 *     - id: zero-questions
 *       description: "Agent routes without any clarifying questions"
 *   weights:
 *     toolCalls: 20
 *     recipes: 40
 *     questionBudget: 20
 *     behaviors: 20
 * ```
 */

import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import type {
  SimTranscript,
  SimExpected,
  ToolCallExpectation,
  RecipeExpectation,
  QuestionBudgetExpectation,
  ExpectedBehavior,
  ScoreWeights,
} from './types.js';

export class SimParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimParseError';
  }
}

/**
 * Split markdown content into YAML frontmatter and body.
 * Frontmatter must be delimited by leading `---\n` and a closing `\n---\n`.
 */
function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    throw new SimParseError('Sim transcript must start with --- frontmatter delimiter.');
  }
  const closingIndex = normalized.indexOf('\n---\n', 4);
  if (closingIndex < 0) {
    throw new SimParseError('Sim transcript frontmatter is missing a closing --- delimiter.');
  }
  return {
    frontmatter: normalized.slice(4, closingIndex),
    body: normalized.slice(closingIndex + 5).trimStart(),
  };
}

function requireString(obj: Record<string, unknown>, field: string, context: string): string {
  const v = obj[field];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new SimParseError(`${context}: "${field}" must be a non-empty string, got ${JSON.stringify(v)}`);
  }
  return v.trim();
}

function parseToolCallExpectation(raw: unknown, context: string): ToolCallExpectation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SimParseError(`${context}.toolCalls must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const ordered = typeof obj['ordered'] === 'boolean' ? obj['ordered'] : false;
  const requiredRaw = obj['required'];
  if (!Array.isArray(requiredRaw)) {
    throw new SimParseError(`${context}.toolCalls.required must be an array`);
  }
  const required = requiredRaw.map((item, i) => {
    if (typeof item === 'string') {
      return { name: item };
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const entry = item as Record<string, unknown>;
      if (typeof entry['name'] !== 'string' || entry['name'].trim() === '') {
        throw new SimParseError(`${context}.toolCalls.required[${i}].name must be a non-empty string`);
      }
      return {
        name: (entry['name'] as string).trim(),
        order: typeof entry['order'] === 'number' ? entry['order'] : undefined,
      };
    }
    throw new SimParseError(`${context}.toolCalls.required[${i}] must be a string or {name, order?} object`);
  });
  return { ordered, required };
}

function parseRecipeExpectation(raw: unknown, context: string): RecipeExpectation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SimParseError(`${context}.recipes must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const requiredRaw = obj['required'];
  if (!Array.isArray(requiredRaw)) {
    throw new SimParseError(`${context}.recipes.required must be an array`);
  }
  const required = requiredRaw.map((item, i) => {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new SimParseError(`${context}.recipes.required[${i}] must be a non-empty string`);
    }
    return item.trim();
  });
  return { required };
}

function parseQuestionBudget(raw: unknown, context: string): QuestionBudgetExpectation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SimParseError(`${context}.questionBudget must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const max = obj['max'];
  if (typeof max !== 'number' || !Number.isInteger(max) || max < 0) {
    throw new SimParseError(`${context}.questionBudget.max must be a non-negative integer`);
  }
  return { max };
}

function parseBehaviors(raw: unknown, context: string): ExpectedBehavior[] {
  if (!Array.isArray(raw)) {
    throw new SimParseError(`${context}.behaviors must be an array`);
  }
  return raw.map((item, i) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new SimParseError(`${context}.behaviors[${i}] must be an object`);
    }
    const entry = item as Record<string, unknown>;
    const id = requireString(entry, 'id', `${context}.behaviors[${i}]`);
    const description = requireString(entry, 'description', `${context}.behaviors[${i}]`);
    return { id, description };
  });
}

function parseWeights(raw: unknown): Partial<ScoreWeights> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SimParseError('expected.weights must be an object');
  }
  const obj = raw as Record<string, unknown>;
  const out: Partial<ScoreWeights> = {};
  for (const key of ['toolCalls', 'recipes', 'questionBudget', 'behaviors'] as const) {
    if (key in obj) {
      const v = obj[key];
      if (typeof v !== 'number' || v < 0 || v > 100) {
        throw new SimParseError(`expected.weights.${key} must be a number between 0 and 100`);
      }
      out[key] = v;
    }
  }
  return out;
}

function parseExpected(raw: unknown): SimExpected {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SimParseError('"expected" field must be an object');
  }
  const obj = raw as Record<string, unknown>;
  const toolCalls = parseToolCallExpectation(obj['toolCalls'], 'expected');
  const recipes = parseRecipeExpectation(obj['recipes'], 'expected');
  const questionBudget = parseQuestionBudget(obj['questionBudget'], 'expected');
  const behaviors = parseBehaviors(obj['behaviors'], 'expected');
  const weights = parseWeights(obj['weights']);
  return { toolCalls, recipes, questionBudget, behaviors, weights };
}

/**
 * Parse a sim transcript from a markdown string.
 */
export function parseSimTranscript(content: string): SimTranscript {
  const { frontmatter, body } = splitFrontmatter(content);
  let parsed: unknown;
  try {
    parsed = parseYaml(frontmatter);
  } catch (err) {
    throw new SimParseError(`Invalid YAML frontmatter: ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SimParseError('Frontmatter must parse to an object');
  }
  const obj = parsed as Record<string, unknown>;
  const id = requireString(obj, 'sim', 'frontmatter');
  const title = requireString(obj, 'title', 'frontmatter');
  const agent = requireString(obj, 'agent', 'frontmatter');
  const description = requireString(obj, 'description', 'frontmatter');
  const expected = parseExpected(obj['expected']);
  return { id, title, agent, description, expected, body };
}

/**
 * Parse a sim transcript from a file path.
 */
export function parseSimTranscriptFile(filePath: string): SimTranscript {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new SimParseError(`Cannot read sim file "${filePath}": ${(err as Error).message}`);
  }
  return parseSimTranscript(content);
}
