/**
 * Regression guard for the systemic A2UI handler tool-call bug (#1062 follow-up).
 *
 * Root cause: multiple event handlers in triage.agent.md used passive language
 * ("emit a form", "route immediately") without naming the required tool, causing
 * the model to respond in prose with toolsExecuted: []. This file ensures every
 * handler that requires a tool call names it explicitly and uses imperative phrasing,
 * so the bug cannot silently regress in a future edit.
 *
 * This is a prompt-text guard — it does NOT invoke the LLM.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TRIAGE_PATH = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'pack-core',
  'src',
  'agents',
  'triage.agent.md',
);

describe('triage.agent.md — handler tool-call imperative language (systemic fix)', () => {
  const body = readFileSync(TRIAGE_PATH, 'utf-8');

  // ─── select_inference → kaito (previously patched) ───────────────────────

  it('kaito handler uses "Immediately call core.search_kaito_models" as first action', () => {
    // Must use imperative phrasing; argument can be inside or outside the backtick span
    // but the tool name itself must be backtick-quoted (agents.test.ts line 198 guards this too)
    expect(body).toMatch(
      /Immediately call `core\.search_kaito_models`\("?\*"?\) as the first action in this turn/,
    );
  });

  // ─── select_inference → generic_endpoint ─────────────────────────────────

  it('generic_endpoint handler names core.show_form with imperative "Immediately call"', () => {
    // Must name the tool — not just say "emit a form"
    expect(body).toMatch(
      /generic_endpoint.*Immediately call `core\.show_form`/s,
    );
  });

  // ─── select_inference → foundry ──────────────────────────────────────────

  it('foundry handler names core.show_form for the data-source RadioGroup', () => {
    // The data-source bullet must say "immediately call `core.show_form`" not just "emit a RadioGroup"
    expect(body).toMatch(
      /immediately call `core\.show_form`.*RadioGroup.*select_data_source/s,
    );
  });

  // ─── choose_* handler bullet list ────────────────────────────────────────

  it('choose_build handler names core.show_form with "immediately call"', () => {
    expect(body).toMatch(
      /choose_build.*immediately call `core\.show_form`/,
    );
  });

  it('choose_review handler names transfer_to_aks_reviewer with "immediately call"', () => {
    expect(body).toMatch(
      /choose_review.*immediately call `transfer_to_aks_reviewer`/,
    );
  });

  it('choose_update handler names core.priorDeploymentContext with "immediately call"', () => {
    expect(body).toMatch(
      /choose_update.*immediately call `core\.priorDeploymentContext`/,
    );
  });

  it('choose_deploy handler names core.show_form with "immediately call"', () => {
    expect(body).toMatch(
      /choose_deploy.*immediately call `core\.show_form`/,
    );
  });

  // ─── select_data_source handler ──────────────────────────────────────────

  it('select_data_source handler names transfer_to_* and core.show_form with "immediately call"', () => {
    // The handler must name both the routing tool and the form tool imperatively
    expect(body).toMatch(
      /select_data_source.*immediately call the appropriate `transfer_to_\*` function.*immediately call `core\.show_form`/s,
    );
  });

  // ─── pick_compound_order (baseline — already had imperative language) ────

  it('pick_compound_order handler already uses "Immediately call core.show_form"', () => {
    expect(body).toMatch(
      /pick_compound_order.*Immediately call `core\.show_form`/s,
    );
  });

  // ─── General gate: preamble promise matches reality ───────────────────────

  it('preamble states handlers name their required tool explicitly', () => {
    expect(body).toContain(
      'The handler descriptions below each name their required tool explicitly.',
    );
  });
});
