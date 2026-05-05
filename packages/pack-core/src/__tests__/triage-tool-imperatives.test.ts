/**
 * Prompt-text regression guard for tool-call imperatives in triage.agent.md.
 *
 * Enforces that every event handler whose execution requires a tool call:
 *   1. Names the required tool explicitly by its identifier.
 *   2. Uses imperative language so the LLM cannot treat the call as optional.
 *
 * Does NOT invoke the LLM — pure string/regex assertions on the .agent.md file.
 * Designed to catch the silent-regression failure class documented in sessions
 * KAITO-path and surface-rejection-path (toolsExecuted: [] with prose narration).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TRIAGE_PATH = resolve(__dirname, '..', 'agents', 'triage.agent.md');

describe('triage.agent.md — handler tool-call imperatives', () => {
  const body = readFileSync(TRIAGE_PATH, 'utf-8');

  // ── kaito handler ──────────────────────────────────────────────────────────

  it('kaito handler imperatively names core.search_kaito_models', () => {
    expect(body).toMatch(/Immediately call `core\.search_kaito_models/);
  });

  it('kaito handler positions the search as the first action in the turn', () => {
    expect(body).toMatch(/first action in this turn/);
  });

  it('kaito handler forbids asking model choice in prose', () => {
    // The "Do NOT ask" guard must name the prose anti-pattern
    expect(body).toMatch(/Do NOT ask.*which model.*prose/s);
  });

  // ── generic_endpoint handler ───────────────────────────────────────────────

  it('generic_endpoint handler imperatively names core.show_form', () => {
    // Must find "Immediately call `core.show_form`" within the generic_endpoint bullet
    const match = /generic_endpoint[\s\S]{0,400}Immediately call `core\.show_form`/.test(body);
    expect(match).toBe(true);
  });

  // ── choose_update handler ─────────────────────────────────────────────────

  it('choose_update handler names core.priorDeploymentContext as required tool', () => {
    // The choose_update bullet must reference core.priorDeploymentContext
    const line = body.split('\n').find((l) => l.includes('choose_update'));
    expect(line).toBeDefined();
    expect(line).toContain('core.priorDeploymentContext');
  });

  it('choose_update handler is imperative (contains "immediately call")', () => {
    const line = body.split('\n').find((l) => l.includes('choose_update'));
    expect(line).toBeDefined();
    expect(line!.toLowerCase()).toContain('immediately call');
  });

  // ── choose_build handler ──────────────────────────────────────────────────

  it('choose_build handler names core.show_form as required tool', () => {
    const line = body.split('\n').find((l) => l.includes('choose_build'));
    expect(line).toBeDefined();
    expect(line).toContain('core.show_form');
  });

  // ── choose_deploy handler ─────────────────────────────────────────────────

  it('choose_deploy handler names core.show_form as required tool', () => {
    const line = body.split('\n').find((l) => l.includes('choose_deploy'));
    expect(line).toBeDefined();
    expect(line).toContain('core.show_form');
  });

  // ── choose_review handler ─────────────────────────────────────────────────

  it('choose_review handler names the transfer function as required action', () => {
    const line = body.split('\n').find((l) => l.includes('choose_review'));
    expect(line).toBeDefined();
    // Must name the transfer action, not just describe handover in prose
    const hasTransfer =
      /transfer_to_aks_reviewer/.test(line!) || /transfer function/.test(line!);
    expect(hasTransfer).toBe(true);
  });

  // ── repo_uplift handler ───────────────────────────────────────────────────

  it('repo_uplift handler calls core.inspect_repo imperatively', () => {
    expect(body).toMatch(/Immediately call `core\.inspect_repo`/);
  });

  it('repo_uplift handler names core.inspect_repo as required tool', () => {
    // The (required tool: ...) annotation must be present
    expect(body).toMatch(/required tool: `core\.inspect_repo`/);
  });

  // ── foundry handler ───────────────────────────────────────────────────────

  it('foundry handler names core.show_form for the data-source RadioGroup', () => {
    // "immediately call `core.show_form`" must appear in the foundry section
    // (between "foundry" bullet and the "kaito" bullet)
    const foundrySection = body.match(
      /- \*\*`foundry`\*\*([\s\S]*?)- \*\*`kaito`\*\*/,
    );
    expect(foundrySection).not.toBeNull();
    expect(foundrySection![1]).toContain('core.show_form');
  });

  // ── line 220 promise: "handlers below each name their required tool explicitly" ─

  it('line-220 promise is present (guards that handlers name their required tool)', () => {
    expect(body).toContain('The handler descriptions below each name their required tool explicitly');
  });
});

describe('triage.agent.md — prose-fallback HARD RULE (surface rejection)', () => {
  const body = readFileSync(TRIAGE_PATH, 'utf-8');

  it('HARD RULE section for prose fallback exists', () => {
    expect(body).toContain('HARD RULE — PROSE FALLBACK WHEN USER REJECTS THE SHARED SURFACE');
  });

  it('trigger list includes the literal phrase "I don\'t want a shared surface"', () => {
    expect(body).toContain("I don't want a shared surface");
  });

  it('trigger list includes "no shared surface"', () => {
    expect(body).toContain('no shared surface');
  });

  it('prose-fallback forbids the "I\'ve refreshed the selection on screen" narration', () => {
    // The rule must call out this exact failure phrase so the LLM recognises it
    expect(body).toMatch(/I.ve refreshed the selection on screen/);
  });

  it('prose-fallback still requires non-UI tool calls', () => {
    expect(body).toMatch(/Still call all non-UI tools/i);
  });

  it('prose-fallback explicitly names core.search_kaito_models as a non-UI tool', () => {
    // The non-UI tools list must name core.search_kaito_models so the kaito
    // handler fires even when the user has rejected the shared surface
    expect(body).toMatch(/non-UI tools[^)]*core\.search_kaito_models/);
  });

  it('prose-fallback forbids calling core.show_form, core.show_card, and core.confirm', () => {
    expect(body).toMatch(/Do NOT attempt to call `core\.show_form`.*`core\.show_card`.*`core\.confirm`/s);
  });
});
