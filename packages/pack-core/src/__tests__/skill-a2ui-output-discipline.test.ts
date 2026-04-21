/**
 * @file skill-a2ui-output-discipline.test.ts
 * @suite a2ui-output-discipline SKILL.md shape guard (#1032 / T7)
 *
 * The `a2ui-output-discipline` skill is shipped to the model prompt. Prior
 * to #1032 it documented the `payload` field as an open-keyed placeholder
 * (`"payload": { /* optional *\/ }`), which teaches the model a shape that
 * OpenAI strict mode now forbids. After #1032 `payload` is a closed object
 * with a fixed key set (confirmed, id, value, action, target).
 *
 * This test locks two invariants on the source SKILL.md:
 *
 *   1. The old `"payload": { /* optional *\/ }` placeholder does NOT appear
 *      (otherwise the shipped prompt still teaches the forbidden shape).
 *   2. At least one key from the closed set appears in the file (so we know
 *      the example is still teaching *something* concrete).
 *
 * Originally requested by Nibbler (QA) on DP Amendment #1 (N6).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SKILL_PATH = resolve(here, '../skills/a2ui-output-discipline/SKILL.md');

describe('a2ui-output-discipline SKILL.md — closed payload contract (#1032)', () => {
  const source = readFileSync(SKILL_PATH, 'utf8');

  it('does not contain the stale open-keyed placeholder `payload: { /* optional */ }`', () => {
    // Match either JSON comment-style or any variant with `optional` inside
    // the payload braces. Keeps the guard permissive so trivial reshuffles
    // don't break it, but the #1032-retired placeholder cannot return.
    const stale = /"payload"\s*:\s*\{\s*\/\*\s*optional\s*\*\/\s*\}/;
    expect(source, 'SKILL.md still contains the pre-#1032 `{ /* optional */ }` payload placeholder').not.toMatch(stale);
  });

  it('mentions at least one key from the closed payload key set', () => {
    // confirmed | id | value | action | target — any mention inside the
    // payload example section is enough to show the closed shape is
    // being taught.
    const keys = ['confirmed', 'id', 'value', 'action', 'target'];
    const found = keys.filter((k) => source.includes(`"${k}"`));
    expect(
      found.length,
      'SKILL.md should illustrate the closed payload key set with at least one of: ' +
        keys.join(', '),
    ).toBeGreaterThan(0);
  });
});
