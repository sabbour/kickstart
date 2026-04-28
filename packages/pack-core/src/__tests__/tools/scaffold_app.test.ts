/**
 * @file scaffold_app.test.ts
 * @suite Phase C — core.scaffold_app tool
 *
 * Tests the skill dispatch orchestrator: deterministic order, path validation,
 * collision detection, traversal rejection, and branch isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  orchestrateScaffoldApp,
  validateOutputPath,
  ALLOWED_SKILLS,
  type SkillDispatcher,
  type SkillResult,
  type ScaffoldAppInput,
} from '../../tools/scaffold_app.js';
import { makeSessionCtx } from './_session-stub.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const WORKSPACE = '/workspace/test-app';

function makePlan(): ScaffoldAppInput['plan'] {
  return { clusterName: 'my-cluster' };
}

function makeInput(track: 'kaito' | 'foundry'): ScaffoldAppInput {
  return {
    plan: makePlan(),
    proposed_services: { track } as ScaffoldAppInput['proposed_services'],
  };
}

/** Creates a dispatcher that returns deterministic empty output paths per skill. */
function makeDispatcher(pathsBySkill: Partial<Record<string, string[]>> = {}): SkillDispatcher {
  return vi.fn(async (skillId): Promise<SkillResult> => ({
    skillId,
    outputPaths: pathsBySkill[skillId] ?? [`${skillId}/output.yaml`],
  }));
}

function makeSession() {
  return makeSessionCtx({
    sessionId: 'test-session-001',
    negotiatedCatalog: { id: 'kickstart', components: [], userActions: [] },
  });
}

// ── ALLOWED_SKILLS ────────────────────────────────────────────────────────────

describe('ALLOWED_SKILLS', () => {
  it('contains exactly the 5 expected skills', () => {
    expect(ALLOWED_SKILLS).toHaveLength(5);
    expect(ALLOWED_SKILLS).toContain('gen-dockerfile');
    expect(ALLOWED_SKILLS).toContain('gen-helm');
    expect(ALLOWED_SKILLS).toContain('gen-kaito-crd');
    expect(ALLOWED_SKILLS).toContain('gen-foundry-wiring');
    expect(ALLOWED_SKILLS).toContain('gen-gha-workflow');
  });
});

// ── Path validation ───────────────────────────────────────────────────────────

describe('validateOutputPath', () => {
  it('accepts a valid relative path', () => {
    expect(() => validateOutputPath(WORKSPACE, 'dockerfile/Dockerfile')).not.toThrow();
  });

  it('rejects absolute paths (leading /)', () => {
    expect(() => validateOutputPath(WORKSPACE, '/etc/passwd')).toThrow(/relative/);
  });

  it('rejects paths with ".." traversal segments', () => {
    expect(() => validateOutputPath(WORKSPACE, '../../../etc/passwd')).toThrow(/traversal/);
  });

  it('rejects paths with embedded ".." segment', () => {
    expect(() => validateOutputPath(WORKSPACE, 'helm/../../../etc/shadow')).toThrow(/traversal/);
  });

  it('rejects paths with null bytes', () => {
    // null byte is caught by traversal check path splitting
    expect(() => validateOutputPath(WORKSPACE, 'valid/path\0../etc')).toThrow();
  });

  it('rejects empty path', () => {
    expect(() => validateOutputPath(WORKSPACE, '')).toThrow(/empty/);
  });

  it('returns the resolved absolute path when workspaceRoot is provided', () => {
    const result = validateOutputPath(WORKSPACE, 'helm/values.yaml');
    expect(result).toBe(`${WORKSPACE}/helm/values.yaml`);
  });

  it('returns the relative path unchanged when workspaceRoot is undefined', () => {
    const result = validateOutputPath(undefined, 'helm/values.yaml');
    expect(result).toBe('helm/values.yaml');
  });

  it('still rejects traversal when workspaceRoot is undefined', () => {
    expect(() => validateOutputPath(undefined, '../../../etc/passwd')).toThrow(/traversal/);
  });

  it('still rejects absolute paths when workspaceRoot is undefined', () => {
    expect(() => validateOutputPath(undefined, '/etc/passwd')).toThrow(/relative/);
  });
});

// ── Branch isolation ──────────────────────────────────────────────────────────

describe('orchestrateScaffoldApp — branch isolation', () => {
  it('kaito track runs gen-kaito-crd and skips gen-foundry-wiring', async () => {
    const dispatch = makeDispatcher();
    const session = makeSession();
    const result = await orchestrateScaffoldApp(makeInput('kaito'), WORKSPACE, dispatch, session);

    const dispatched = (dispatch as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    ) as string[];
    expect(dispatched).toContain('gen-kaito-crd');
    expect(dispatched).not.toContain('gen-foundry-wiring');
    expect(result.skillsRun).toContain('gen-kaito-crd');
    expect(result.skillsRun).not.toContain('gen-foundry-wiring');
  });

  it('foundry track runs gen-foundry-wiring and skips gen-kaito-crd', async () => {
    const dispatch = makeDispatcher();
    const session = makeSession();
    const result = await orchestrateScaffoldApp(makeInput('foundry'), WORKSPACE, dispatch, session);

    const dispatched = (dispatch as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    ) as string[];
    expect(dispatched).toContain('gen-foundry-wiring');
    expect(dispatched).not.toContain('gen-kaito-crd');
    expect(result.skillsRun).toContain('gen-foundry-wiring');
    expect(result.skillsRun).not.toContain('gen-kaito-crd');
  });
});

// ── Deterministic dispatch order ──────────────────────────────────────────────

describe('orchestrateScaffoldApp — dispatch order', () => {
  it('kaito track: dockerfile → helm → kaito-crd → gha-workflow', async () => {
    const dispatch = makeDispatcher();
    const session = makeSession();
    await orchestrateScaffoldApp(makeInput('kaito'), WORKSPACE, dispatch, session);

    const dispatched = (dispatch as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(dispatched).toEqual([
      'gen-dockerfile',
      'gen-helm',
      'gen-kaito-crd',
      'gen-gha-workflow',
    ]);
  });

  it('foundry track: dockerfile → helm → foundry-wiring → gha-workflow', async () => {
    const dispatch = makeDispatcher();
    const session = makeSession();
    await orchestrateScaffoldApp(makeInput('foundry'), WORKSPACE, dispatch, session);

    const dispatched = (dispatch as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(dispatched).toEqual([
      'gen-dockerfile',
      'gen-helm',
      'gen-foundry-wiring',
      'gen-gha-workflow',
    ]);
  });
});

// ── Path collision detection ──────────────────────────────────────────────────

describe('orchestrateScaffoldApp — path collision', () => {
  it('throws with both skill names when two skills emit the same output path', async () => {
    const dispatch = makeDispatcher({
      'gen-dockerfile': ['shared/output.yaml'],
      'gen-helm': ['shared/output.yaml'],
    });
    const session = makeSession();

    await expect(
      orchestrateScaffoldApp(makeInput('kaito'), WORKSPACE, dispatch, session),
    ).rejects.toThrow(/collision/);
  });

  it('error message includes the colliding path', async () => {
    const dispatch = makeDispatcher({
      'gen-dockerfile': ['helm/chart.yaml'],
      'gen-helm': ['helm/chart.yaml'],
    });
    const session = makeSession();

    await expect(
      orchestrateScaffoldApp(makeInput('kaito'), WORKSPACE, dispatch, session),
    ).rejects.toThrow(/helm\/chart\.yaml/);
  });

  it('error message includes both skill names', async () => {
    const dispatch = makeDispatcher({
      'gen-dockerfile': ['conflict.yaml'],
      'gen-helm': ['conflict.yaml'],
    });
    const session = makeSession();

    await expect(
      orchestrateScaffoldApp(makeInput('kaito'), WORKSPACE, dispatch, session),
    ).rejects.toThrow(/gen-dockerfile.*gen-helm|gen-helm.*gen-dockerfile/);
  });

  it('accepts distinct output paths from different skills', async () => {
    const dispatch = makeDispatcher({
      'gen-dockerfile': ['Dockerfile'],
      'gen-helm': ['helm/values.yaml'],
      'gen-kaito-crd': ['kaito/workspace.yaml'],
      'gen-gha-workflow': ['.github/workflows/deploy.yaml'],
    });
    const session = makeSession();

    await expect(
      orchestrateScaffoldApp(makeInput('kaito'), WORKSPACE, dispatch, session),
    ).resolves.toMatchObject({ status: 'complete' });
  });
});

// ── Path traversal rejection ──────────────────────────────────────────────────

describe('orchestrateScaffoldApp — path traversal rejection', () => {
  it('rejects "../../../etc/passwd" from a skill output', async () => {
    const dispatch = makeDispatcher({
      'gen-dockerfile': ['../../../etc/passwd'],
    });
    const session = makeSession();

    await expect(
      orchestrateScaffoldApp(makeInput('kaito'), WORKSPACE, dispatch, session),
    ).rejects.toThrow(/traversal/);
  });

  it('rejects absolute paths returned by a skill', async () => {
    const dispatch = makeDispatcher({
      'gen-dockerfile': ['/etc/cron.d/evil'],
    });
    const session = makeSession();

    await expect(
      orchestrateScaffoldApp(makeInput('kaito'), WORKSPACE, dispatch, session),
    ).rejects.toThrow(/relative/);
  });
});

// ── GenerationProgress ticking ────────────────────────────────────────────────

describe('orchestrateScaffoldApp — GenerationProgress UI', () => {
  it('creates a surface before ticking progress', async () => {
    const dispatch = makeDispatcher();
    const session = makeSession();
    await orchestrateScaffoldApp(makeInput('kaito'), WORKSPACE, dispatch, session);

    const emissions = session.a2uiEmissions as unknown as Array<Record<string, unknown>>;
    const createMsg = emissions.find((e) => 'createSurface' in e);
    expect(createMsg).toBeDefined();
  });

  it('emits a GenerationProgress updateComponents after each skill', async () => {
    const dispatch = makeDispatcher();
    const session = makeSession();
    await orchestrateScaffoldApp(makeInput('kaito'), WORKSPACE, dispatch, session);

    const emissions = session.a2uiEmissions as unknown as Array<Record<string, unknown>>;
    const updates = emissions.filter((e) => 'updateComponents' in e);

    // kaito runs 4 skills, each emits 2 updates (running + complete/done) = 8
    // but the final skill also emits 'complete' overallStatus
    // At minimum: one update per skill (when complete)
    expect(updates.length).toBeGreaterThanOrEqual(4);
  });

  it('emits final overallStatus=complete after all skills finish', async () => {
    const dispatch = makeDispatcher();
    const session = makeSession();
    await orchestrateScaffoldApp(makeInput('kaito'), WORKSPACE, dispatch, session);

    const emissions = session.a2uiEmissions as unknown as Array<Record<string, unknown>>;
    const updateEmissions = emissions.filter((e) => 'updateComponents' in e);
    const lastUpdate = updateEmissions[updateEmissions.length - 1] as {
      updateComponents: { components: Array<{ overallStatus: string }> };
    };

    expect(lastUpdate.updateComponents.components[0]!.overallStatus).toBe('complete');
  });

  it('does not tick more than one GenerationProgress surface per run', async () => {
    const dispatch = makeDispatcher();
    const session = makeSession();
    await orchestrateScaffoldApp(makeInput('foundry'), WORKSPACE, dispatch, session);

    const emissions = session.a2uiEmissions as unknown as Array<Record<string, unknown>>;
    const creates = emissions.filter((e) => 'createSurface' in e);
    expect(creates).toHaveLength(1);
  });
});

// ── In-browser mode (no workspaceRoot) ───────────────────────────────────────

describe('orchestrateScaffoldApp — in-browser mode (no workspaceRoot)', () => {
  it('completes successfully without a workspaceRoot', async () => {
    const dispatch = makeDispatcher();
    const session = makeSession();
    const result = await orchestrateScaffoldApp(makeInput('kaito'), undefined, dispatch, session);
    expect(result.status).toBe('complete');
  });

  it('still runs all 4 skills for the kaito track', async () => {
    const dispatch = makeDispatcher();
    const session = makeSession();
    const result = await orchestrateScaffoldApp(makeInput('kaito'), undefined, dispatch, session);
    expect(result.skillsRun).toEqual([
      'gen-dockerfile',
      'gen-helm',
      'gen-kaito-crd',
      'gen-gha-workflow',
    ]);
  });

  it('returns outputPaths relative to no root', async () => {
    const dispatch = makeDispatcher({
      'gen-dockerfile': ['Dockerfile'],
      'gen-helm': ['helm/values.yaml'],
      'gen-kaito-crd': ['kaito/workspace.yaml'],
      'gen-gha-workflow': ['.github/workflows/deploy.yaml'],
    });
    const session = makeSession();
    const result = await orchestrateScaffoldApp(makeInput('kaito'), undefined, dispatch, session);
    expect(result.outputPaths).toContain('Dockerfile');
    expect(result.outputPaths).toContain('helm/values.yaml');
  });

  it('still rejects traversal paths even without a workspaceRoot', async () => {
    const dispatch = makeDispatcher({ 'gen-dockerfile': ['../../../etc/passwd'] });
    const session = makeSession();
    await expect(
      orchestrateScaffoldApp(makeInput('kaito'), undefined, dispatch, session),
    ).rejects.toThrow(/traversal/);
  });

  it('still rejects absolute paths even without a workspaceRoot', async () => {
    const dispatch = makeDispatcher({ 'gen-dockerfile': ['/etc/cron.d/evil'] });
    const session = makeSession();
    await expect(
      orchestrateScaffoldApp(makeInput('kaito'), undefined, dispatch, session),
    ).rejects.toThrow(/relative/);
  });

  it('still emits GenerationProgress A2UI events', async () => {
    const dispatch = makeDispatcher();
    const session = makeSession();
    await orchestrateScaffoldApp(makeInput('foundry'), undefined, dispatch, session);

    const emissions = session.a2uiEmissions as unknown as Array<Record<string, unknown>>;
    expect(emissions.some((e) => 'createSurface' in e)).toBe(true);
    expect(emissions.some((e) => 'updateComponents' in e)).toBe(true);
  });
});
