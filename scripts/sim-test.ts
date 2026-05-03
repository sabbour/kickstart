#!/usr/bin/env tsx
/**
 * sim-test CLI — sim-as-regression-test runner.
 *
 * Usage:
 *   npm run sim-test -- --sim sims/sim-01-sam-nextjs.md --agent triage.agent.md
 *   npm run sim-test -- --sim sims/sim-01-sam-nextjs.md --actual output.json
 *   npm run sim-test -- --sim sims/sim-01-sam-nextjs.md --list
 *
 * Modes:
 *   --list          Print the expected criteria from the fixture (Phase 1 reviewer checklist).
 *   --actual <file> Compare a pre-recorded ActualOutput JSON against the fixture.
 *   (default)       Print the fixture criteria as a reviewer checklist (same as --list).
 *
 * ActualOutput JSON schema:
 *   {
 *     "toolCalls": [{"name": "core.emit_ui", "index": 0}],
 *     "recipesEmitted": [{"recipeId": "R1"}, {"recipeId": "R17"}],
 *     "questionCount": 0,
 *     "behaviorsObserved": ["zero-questions", "r17-close"]
 *   }
 *
 * Exit codes:
 *   0 — pass (overall score ≥ 70)
 *   1 — fail (overall score < 70)
 *   2 — usage error / parse error
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSimTranscriptFile, SimParseError } from '../packages/sim-test/src/parser.js';
import { scoreSimRun } from '../packages/sim-test/src/scorer.js';
import type { ActualOutput, SimScore, CriterionScore } from '../packages/sim-test/src/types.js';

// ─── Argument parsing ────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  const next = args[idx + 1];
  if (!next || next.startsWith('-')) return '';
  return next;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const simPath = getFlag('--sim');
const actualPath = getFlag('--actual');
const listMode = hasFlag('--list') || !actualPath;

if (!simPath) {
  console.error('❌  Usage: npm run sim-test -- --sim <transcript.md> [--actual <output.json>|--list]');
  process.exit(2);
}

// ─── Load transcript ─────────────────────────────────────────────────────────

let transcript: ReturnType<typeof parseSimTranscriptFile>;

try {
  transcript = parseSimTranscriptFile(resolve(simPath));
} catch (err) {
  if (err instanceof SimParseError) {
    console.error(`❌  Sim parse error: ${err.message}`);
  } else {
    console.error(`❌  Cannot load sim transcript: ${(err as Error).message}`);
  }
  process.exit(2);
}

// ─── Header ──────────────────────────────────────────────────────────────────

console.log('');
console.log(`╭──────────────────────────────────────────────────────────────╮`);
console.log(`│  sim-test  │  ${transcript.id.padEnd(8)}  │  ${transcript.title.slice(0, 36).padEnd(36)}  │`);
console.log(`╰──────────────────────────────────────────────────────────────╯`);
console.log(`  Agent:  ${transcript.agent}`);
console.log(`  Desc:   ${transcript.description}`);
console.log('');

// ─── List mode (Phase 1 reviewer checklist) ───────────────────────────────────

if (listMode) {
  console.log('📋  Expected criteria (Phase 1 reviewer checklist):');
  console.log('');

  const { toolCalls, recipes, questionBudget, behaviors, weights } = transcript.expected;

  console.log(`  Tool Calls  (weight: ${weights?.toolCalls ?? 20}%)`);
  if (toolCalls.required.length === 0) {
    console.log('    (none required)');
  } else {
    console.log(`    Ordered: ${toolCalls.ordered}`);
    for (const tc of toolCalls.required) {
      const order = tc.order !== undefined ? ` [order: ${tc.order}]` : '';
      console.log(`    • ${tc.name}${order}`);
    }
  }

  console.log('');
  console.log(`  Recipes  (weight: ${weights?.recipes ?? 40}%)`);
  if (recipes.required.length === 0) {
    console.log('    (none required)');
  } else {
    for (const r of recipes.required) {
      console.log(`    • ${r}`);
    }
  }

  console.log('');
  console.log(`  Question Budget  (weight: ${weights?.questionBudget ?? 20}%)`);
  console.log(`    Maximum questions: ${questionBudget.max}`);

  console.log('');
  console.log(`  Behaviours  (weight: ${weights?.behaviors ?? 20}%)`);
  if (behaviors.length === 0) {
    console.log('    (none required)');
  } else {
    for (const b of behaviors) {
      console.log(`    • ${b.id}: ${b.description}`);
    }
  }

  console.log('');
  console.log('  ℹ️   Phase 1 mode: no --actual file provided. Human reviewer judges.');
  console.log('     To score automatically: npm run sim-test -- --sim <file> --actual <output.json>');
  console.log('');
  process.exit(0);
}

// ─── Score mode ───────────────────────────────────────────────────────────────

let actual: ActualOutput;

try {
  const raw = readFileSync(resolve(actualPath!), 'utf8');
  actual = JSON.parse(raw) as ActualOutput;
} catch (err) {
  console.error(`❌  Cannot load actual output file "${actualPath}": ${(err as Error).message}`);
  process.exit(2);
}

const result: SimScore = scoreSimRun(transcript, actual);

function renderBar(score: number): string {
  const filled = Math.round(score / 5);
  const empty = 20 - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${score.toString().padStart(3)}`;
}

function statusIcon(pass: boolean): string {
  return pass ? '✅' : '❌';
}

function formatCriterion(c: CriterionScore): string {
  return `  ${statusIcon(c.pass)} ${c.name.padEnd(16)} ${renderBar(c.score)}  (weight: ${c.weight}%)`;
}

console.log('📊  Score Results:');
console.log('');
for (const criterion of result.criteria) {
  console.log(formatCriterion(criterion));
  console.log(`       ${criterion.details}`);
  console.log('');
}

console.log(`  ──────────────────────────────────────────────────────────────`);
console.log(`  ${statusIcon(result.pass)} Overall Score   ${renderBar(result.overallScore)}`);
console.log('');

if (result.pass) {
  console.log(`  🎉  PASS — sim ${result.simId} meets the regression threshold (≥70).`);
} else {
  console.log(`  ⚠️   FAIL — sim ${result.simId} is below the regression threshold (<70).`);
}

console.log('');
process.exit(result.pass ? 0 : 1);
