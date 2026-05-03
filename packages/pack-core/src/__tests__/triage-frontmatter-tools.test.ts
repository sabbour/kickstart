/**
 * @file triage-frontmatter-tools.test.ts
 * @suite Loader-resolvable invariant for triage frontmatter (#198 R6)
 *
 * Nibbler R6 (codereview:approved-with-condition on DP v1, comment 4336944762):
 *
 *   "core.priorDeploymentContext in frontmatter when the tool isn't registered
 *    → load failure risk. The agent loader (loadAgentFile in
 *    packages/harness/src/runtime/loader-agent.ts) validates frontmatter
 *    `tools:` against the registered allowlist via resolveToolAllowlist; an
 *    unregistered tool name fails the load."
 *
 * R6 resolution (per Nibbler option (a)): triage MUST NOT list any unregistered
 * tool in its frontmatter. Phase 3's `core.priorDeploymentContext` is reserved
 * but not added in Phase 2; iteration mode degrades to `core.inspect_repo` +
 * `core.read_file`. This test pins that invariant so the rewrite (and any
 * future patch) cannot silently re-add an unregistered tool name and pass CI
 * by skipping the harness load path.
 *
 * Note: `core.read_skill` is the one tool intentionally omitted from this
 * registry by design — see the Policy Exception comment in
 * `packages/pack-core/src/tools/read_skill.ts` (registered universally by the
 * runner, never via per-pack toolAllowlist). It's added to the
 * UNIVERSAL_HARNESS_TOOLS allowlist below so triage can reference it in prose
 * without listing it in frontmatter (which is correct usage).
 */

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';

import { createCoreTools } from '../core-tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TRIAGE_PATH = path.resolve(__dirname, '../agents/triage.agent.md');

/**
 * Tools provided universally by the harness runner (NOT via pack toolAllowlist).
 * See `packages/pack-core/src/tools/read_skill.ts` "Policy exception" comment.
 */
const UNIVERSAL_HARNESS_TOOLS = new Set<string>(['core.read_skill']);

function readFrontmatter(filePath: string): Record<string, unknown> {
  const raw = readFileSync(filePath, 'utf8');
  const match = /^---\n([\s\S]*?)\n---/.exec(raw);
  if (!match) throw new Error(`No frontmatter found in ${filePath}`);
  return parseYaml(match[1]) as Record<string, unknown>;
}

describe('triage frontmatter — loader-resolvable invariant (R6)', () => {
  const fm = readFrontmatter(TRIAGE_PATH);
  const tools = ((fm.tools as string[] | undefined) ?? []).slice();
  const registered = new Set(createCoreTools([]).map((t) => t.name));

  it('every tool in triage frontmatter is registered in pack-core OR is a universal harness tool', () => {
    const unresolved = tools.filter(
      (name) => !registered.has(name) && !UNIVERSAL_HARNESS_TOOLS.has(name),
    );
    expect(
      unresolved,
      `Unresolved triage frontmatter tools (would fail loadAgentFile.resolveToolAllowlist): ${unresolved.join(', ')}`,
    ).toEqual([]);
  });

  it('triage frontmatter DOES list core.priorDeploymentContext (Phase 3 implemented in #218)', () => {
    expect(
      tools.includes('core.priorDeploymentContext'),
      'core.priorDeploymentContext was added in Phase 3 (#218); it must be present in triage frontmatter and registered in pack-core.',
    ).toBe(true);
  });

  it('triage frontmatter does NOT list core.read_skill (universally registered by runner)', () => {
    expect(
      tools.includes('core.read_skill'),
      'core.read_skill is provided universally by the harness runner — listing it in toolAllowlist would be redundant. See packages/pack-core/src/tools/read_skill.ts Policy Exception comment.',
    ).toBe(false);
  });
});
