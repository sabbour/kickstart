/**
 * Layer 2 of #1062: the triage agent prompt must branch on A2UI events and
 * NOT re-emit the opening intent menu once a `choose_*` event has been
 * confirmed.
 *
 * This is a prompt-text regression guard — it does not invoke the LLM. Its
 * job is to keep the branch-on-event instructions from silently disappearing
 * in a future edit (which is exactly how #1062 slipped into production).
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

describe('triage.agent.md — branch-on-event instructions (#1062 Layer 2)', () => {
  const body = readFileSync(TRIAGE_PATH, 'utf-8');

  it('documents the [A2UI event] marker shape the server injects', () => {
    expect(body).toContain('[A2UI event] name=');
  });

  it('tells the agent NOT to re-emit the intent menu once an event is received', () => {
    // Two non-negotiable phrases — either can be reworded but the semantics must be kept.
    const forbidsMenuReemit =
      /do not re-emit the intent.?choice menu/i.test(body) ||
      /do not emit another one in response to its selection/i.test(body);
    expect(forbidsMenuReemit).toBe(true);
  });

  it('covers build, review, update, and deploy intent branches', () => {
    expect(body).toMatch(/choose_build/);
    expect(body).toMatch(/choose_review/);
    expect(body).toMatch(/choose_update/);
    expect(body).toMatch(/choose_deploy/);
  });
});

describe('triage.agent.md — specialist handoff routing (#107)', () => {
  const body = readFileSync(TRIAGE_PATH, 'utf-8');

  it('declares aks.architect as a handoff target in frontmatter', () => {
    expect(body).toContain('agent: aks.architect');
  });

  it('declares azure.architect as a handoff target in frontmatter', () => {
    expect(body).toContain('agent: azure.architect');
  });

  it('declares github.publisher as a handoff target in frontmatter', () => {
    expect(body).toContain('agent: github.publisher');
  });

  it('routes agentic_app + AKS intent to aks.architect', () => {
    expect(body).toContain('aks.architect');
    expect(body).toMatch(/agentic.app.*aks|aks.*agentic.app/si);
  });

  it('routes azure infra to azure.architect', () => {
    expect(body).toContain('azure.architect');
  });

  it('routes publish flow to github.publisher', () => {
    expect(body).toContain('github.publisher');
  });
});
