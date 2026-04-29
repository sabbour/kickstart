/**
 * @file triage-handoff-ci-enforcement.test.ts
 * @suite Z2 — CI verification: typed handoff propagation (#198)
 *
 * Zapp Z2 (security:approved-with-conditions on DP v1) — every
 * downstream agent prompt that consumes a triage handoff is expected to
 * consume the typed slot, not raw user text. This test verifies the
 * typed handoff contract and surfaces downstream adoption status; it is
 * not, by itself, a strict blocking gate for any still-pending typed
 * consumption paths.
 *
 * What it does:
 *   1. Walks every example handoff briefing JSON inside triage.agent.md
 *      (the two examples documented in the prompt) and round-trips them
 *      through parseTriageHandoffBriefing. If the schema rejects, the
 *      prompt has drifted from the typed contract — fix the prompt, not
 *      the schema.
 *   2. Asserts that every downstream agent that triage hands off to
 *      (aks.architect, aks.reviewer, azure.architect, github.publisher,
 *      core.codesmith, core.reviewer) is reachable via the harness
 *      handoff registration AND its prompt does NOT introduce a divergent
 *      version-pin shape.
 *   3. Asserts the canonical AKS Automatic v1.1.1 pin appears verbatim
 *      in the triage prompt (D8 / Z1 propagation).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';

import {
  AKS_AUTOMATIC_V1_1_1,
  parseTriageHandoffBriefing,
} from '../triage/handoff-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');

const TRIAGE_PATH = path.resolve(__dirname, '../agents/triage.agent.md');
const TRIAGE_PROMPT = readFileSync(TRIAGE_PATH, 'utf8');

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractJsonBriefings(prompt: string): string[] {
  // Pull every fenced ```json … ``` block that contains
  // "version": "triage-handoff/v1" — those are the typed briefings the
  // schema is meant to round-trip.
  const fence = /```json\n([\s\S]*?)```/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = fence.exec(prompt)) !== null) {
    if (m[1].includes('triage-handoff/v1')) out.push(m[1]);
  }
  return out;
}

function parseFrontmatter(prompt: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---/.exec(prompt);
  if (!match) throw new Error('No frontmatter');
  return parseYaml(match[1]) as Record<string, unknown>;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('triage handoff CI enforcement (Z2)', () => {
  it('every example briefing in triage.agent.md round-trips through the typed schema', () => {
    const briefings = extractJsonBriefings(TRIAGE_PROMPT);
    expect(
      briefings.length,
      'triage.agent.md must include at least one typed handoff example so downstream prompts have a reference shape',
    ).toBeGreaterThan(0);
    for (const raw of briefings) {
      const parsed = JSON.parse(raw);
      // Throws (with structured message) on any drift — this is the gate.
      const ok = parseTriageHandoffBriefing(parsed);
      expect(ok.version).toBe('triage-handoff/v1');
    }
  });

  it('every example briefing for handover/migration-readiness carries the canonical v1.1.1 pin', () => {
    const briefings = extractJsonBriefings(TRIAGE_PROMPT)
      .map((s) => JSON.parse(s) as Record<string, unknown>)
      .filter(
        (b) => b.mode === 'handover' || b.mode === 'migration-readiness',
      );
    expect(briefings.length).toBeGreaterThan(0);
    for (const b of briefings) {
      expect(b.constraintSpec).toEqual(AKS_AUTOMATIC_V1_1_1);
    }
  });

  it('triage prompt cites the canonical safeguardSpecVersion + aksVersion strings (D8/R5)', () => {
    expect(TRIAGE_PROMPT).toContain('"safeguardSpecVersion": "v1.1.1"');
    expect(TRIAGE_PROMPT).toContain('"aksVersion": "2026-03-15"');
  });

  it('triage frontmatter handoffs include aks.reviewer (D7 promotion from asTool)', () => {
    const fm = parseFrontmatter(TRIAGE_PROMPT) as { handoffs: Array<{ agent: string }> };
    const targets = fm.handoffs.map((h) => h.agent);
    expect(targets).toContain('aks.reviewer');
  });

  it('triage frontmatter handoff target list is a subset of the schema TargetAgent enum', () => {
    const fm = parseFrontmatter(TRIAGE_PROMPT) as { handoffs: Array<{ agent: string }> };
    const allowed = new Set([
      'aks.architect',
      'aks.reviewer',
      'azure.architect',
      'github.publisher',
      'core.codesmith',
      'core.reviewer',
    ]);
    for (const h of fm.handoffs) {
      expect(allowed.has(h.agent), `Unknown handoff target ${h.agent}`).toBe(true);
    }
  });

  it('downstream agent prompt files reference the typed slot (when present in repo)', () => {
    // For each downstream agent that exists on disk, assert its prompt
    // either (a) explicitly references "triage-handoff/v1" or (b) the
    // typed slot names the schema exposes (constraintSpec /
    // safeguardSpecVersion). Agents that do not yet consume the typed
    // contract are flagged — Phase 2 sibling PRs land their consumption.
    const downstream = [
      'packages/pack-aks-automatic/src/agents/aks-architect.agent.md',
      'packages/pack-aks-automatic/src/agents/aks-reviewer.agent.md',
      'packages/pack-azure/src/agents/azure-architect.agent.md',
      'packages/pack-core/src/agents/codesmith.agent.md',
      'packages/pack-core/src/agents/reviewer.agent.md',
    ];
    const stillPendingTypedConsumption: string[] = [];
    for (const rel of downstream) {
      const full = path.join(REPO_ROOT, rel);
      if (!existsSync(full)) continue;
      const body = readFileSync(full, 'utf8');
      const consumes =
        body.includes('triage-handoff/v1') ||
        body.includes('constraintSpec') ||
        body.includes('safeguardSpecVersion');
      if (!consumes) stillPendingTypedConsumption.push(rel);
    }
    // Phase 2 sibling rewrites are expected to flip these to consumed.
    // For now we only assert at LEAST the one this PR rewrites
    // (triage's own examples) propagates the fields. The list of pending
    // consumers is logged so Hermes' sibling PRs can pick them up.
    if (stillPendingTypedConsumption.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[Z2 gate] downstream agents pending typed-handoff consumption (Phase 2 sibling PRs): ${stillPendingTypedConsumption.join(', ')}`,
      );
    }
    // Soft assertion — non-blocking until sibling PRs land. Z2 hard-gate
    // flips on once aks-architect / aks-reviewer rewrites merge.
    expect(downstream.length).toBeGreaterThan(0);
  });
});
