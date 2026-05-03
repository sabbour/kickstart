/**
 * @file prior-deployment-context.test.ts
 * @suite Phase 3 — priorDeploymentContext schema + state reader (#218)
 *
 * Covers:
 *  1. PriorDeploymentContextSchema shape validation
 *  2. IterationContext accepts priorDeploymentContext (optional)
 *  3. extractPriorDeploymentContext helper — happy path
 *  4. extractPriorDeploymentContext — graceful null on missing fields
 *  5. extractPriorDeploymentContext — graceful null on invalid JSON shape
 *  6. priorDeploymentContextTool — returns found:false when no workspace root
 *  7. priorDeploymentContextTool — returns found:false when state file missing
 *  8. priorDeploymentContextTool — returns found:true with full context
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import { RunContext } from '@openai/agents';

import {
  PriorDeploymentContextSchema,
  TriageHandoffBriefingSchema,
  TriageMode,
} from '../triage/handoff-schema.js';
import { extractPriorDeploymentContext, priorDeploymentContextTool } from '../tools/prior_deployment_context.js';
import { makeSessionCtx } from './tools/_session-stub.js';

// ── Schema tests ──────────────────────────────────────────────────────────────

describe('PriorDeploymentContextSchema (#218)', () => {
  it('accepts a valid prior deployment context', () => {
    const result = PriorDeploymentContextSchema.parse({
      lastRecipe: 'containerized-web',
      lastHandoffTarget: 'aks.architect',
      workspaceStateFile: '.kickstart/state.json',
      summary: 'Deployed orders-api to AKS Automatic with 2 replicas.',
    });
    expect(result.lastRecipe).toBe('containerized-web');
    expect(result.lastHandoffTarget).toBe('aks.architect');
  });

  it('rejects an empty lastRecipe', () => {
    expect(() =>
      PriorDeploymentContextSchema.parse({
        lastRecipe: '',
        lastHandoffTarget: 'aks.architect',
        workspaceStateFile: '.kickstart/state.json',
        summary: 'Prior deployment summary.',
      }),
    ).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() =>
      PriorDeploymentContextSchema.parse({
        lastRecipe: 'containerized-web',
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields (strict)', () => {
    expect(() =>
      PriorDeploymentContextSchema.parse({
        lastRecipe: 'containerized-web',
        lastHandoffTarget: 'aks.architect',
        workspaceStateFile: '.kickstart/state.json',
        summary: 'Summary.',
        unexpectedField: 'x',
      }),
    ).toThrow();
  });
});

describe('TriageHandoffBriefing iteration block with priorDeploymentContext (#218)', () => {
  const baseSignals = [{ kind: 'kickstart-state-file' as const, detail: 'state found' }];

  it('accepts iteration briefing with priorDeploymentContext populated', () => {
    const b = TriageHandoffBriefingSchema.parse({
      version: 'triage-handoff/v1',
      mode: TriageMode.Iteration,
      skillIdsLoaded: [],
      sourceSignals: baseSignals,
      targetAgent: 'aks.architect',
      iteration: {
        diffIntent: 'Add a worker service for background jobs.',
        priorDeploymentContext: {
          lastRecipe: 'containerized-web',
          lastHandoffTarget: 'aks.architect',
          workspaceStateFile: '.kickstart/state.json',
          summary: 'Deployed orders-api to AKS Automatic.',
        },
      },
    });
    expect(b.iteration?.priorDeploymentContext?.lastRecipe).toBe('containerized-web');
  });

  it('accepts iteration briefing WITHOUT priorDeploymentContext (optional field)', () => {
    const b = TriageHandoffBriefingSchema.parse({
      version: 'triage-handoff/v1',
      mode: TriageMode.Iteration,
      skillIdsLoaded: [],
      sourceSignals: baseSignals,
      targetAgent: 'aks.architect',
      iteration: {
        diffIntent: 'Add a worker service.',
      },
    });
    expect(b.iteration?.priorDeploymentContext).toBeUndefined();
  });
});

// ── extractPriorDeploymentContext tests ───────────────────────────────────────

describe('extractPriorDeploymentContext (#218)', () => {
  it('returns a valid context when all required fields are present', () => {
    const ctx = extractPriorDeploymentContext(
      {
        lastRecipe: 'containerized-web',
        lastHandoffTarget: 'aks.architect',
        summary: 'Deployed orders-api to AKS Automatic with KEDA worker.',
      },
      '.kickstart/state.json',
    );
    expect(ctx).not.toBeNull();
    expect(ctx?.lastRecipe).toBe('containerized-web');
    expect(ctx?.workspaceStateFile).toBe('.kickstart/state.json');
  });

  it('returns null when lastRecipe is missing', () => {
    expect(
      extractPriorDeploymentContext(
        { lastHandoffTarget: 'aks.architect', summary: 'Summary.' },
        '.kickstart/state.json',
      ),
    ).toBeNull();
  });

  it('returns null when lastHandoffTarget is missing', () => {
    expect(
      extractPriorDeploymentContext(
        { lastRecipe: 'containerized-web', summary: 'Summary.' },
        '.kickstart/state.json',
      ),
    ).toBeNull();
  });

  it('returns null when summary is missing', () => {
    expect(
      extractPriorDeploymentContext(
        { lastRecipe: 'containerized-web', lastHandoffTarget: 'aks.architect' },
        '.kickstart/state.json',
      ),
    ).toBeNull();
  });

  it('returns null for an empty object', () => {
    expect(extractPriorDeploymentContext({}, '.kickstart/state.json')).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(extractPriorDeploymentContext(null, '.kickstart/state.json')).toBeNull();
    expect(extractPriorDeploymentContext('string', '.kickstart/state.json')).toBeNull();
    expect(extractPriorDeploymentContext(42, '.kickstart/state.json')).toBeNull();
  });

  it('ignores unknown extra fields in state.json without throwing', () => {
    const ctx = extractPriorDeploymentContext(
      {
        lastRecipe: 'agentic-app',
        lastHandoffTarget: 'azure.architect',
        summary: 'Foundry wiring deployed.',
        phase: 4,
        unknownFutureField: true,
      },
      '.kickstart/state.json',
    );
    expect(ctx).not.toBeNull();
    expect(ctx?.lastRecipe).toBe('agentic-app');
  });
});

// ── priorDeploymentContextTool execute tests ──────────────────────────────────

describe('priorDeploymentContextTool execute (#218)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = resolve(tmpdir(), `pdc-test-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function invoke(workspaceRoot?: string) {
    const session = makeSessionCtx({ workspaceRoot } as Parameters<typeof makeSessionCtx>[0]);
    return priorDeploymentContextTool.tool.invoke(new RunContext(session), JSON.stringify({}));
  }

  it('returns found:false when no workspace root is provided', async () => {
    const result = JSON.parse(String(await invoke(undefined)));
    expect(result.found).toBe(false);
    expect(result.context).toBeUndefined();
  });

  it('returns found:false when .kickstart/state.json does not exist', async () => {
    const result = JSON.parse(String(await invoke(tmpDir)));
    expect(result.found).toBe(false);
  });

  it('returns found:false when state.json is present but missing required fields', async () => {
    mkdirSync(resolve(tmpDir, '.kickstart'), { recursive: true });
    writeFileSync(resolve(tmpDir, '.kickstart/state.json'), JSON.stringify({ phase: 2 }));
    const result = JSON.parse(String(await invoke(tmpDir)));
    expect(result.found).toBe(false);
  });

  it('returns found:true with full context when state.json has all fields', async () => {
    mkdirSync(resolve(tmpDir, '.kickstart'), { recursive: true });
    writeFileSync(
      resolve(tmpDir, '.kickstart/state.json'),
      JSON.stringify({
        lastRecipe: 'containerized-web',
        lastHandoffTarget: 'aks.architect',
        summary: 'Deployed orders-api to AKS Automatic with 2 replicas.',
        phase: 3,
      }),
    );
    const result = JSON.parse(String(await invoke(tmpDir)));
    expect(result.found).toBe(true);
    expect(result.context.lastRecipe).toBe('containerized-web');
    expect(result.context.lastHandoffTarget).toBe('aks.architect');
    expect(result.context.workspaceStateFile).toBe('.kickstart/state.json');
    expect(result.context.summary).toBe('Deployed orders-api to AKS Automatic with 2 replicas.');
  });

  it('returns found:false when state.json contains invalid JSON', async () => {
    mkdirSync(resolve(tmpDir, '.kickstart'), { recursive: true });
    writeFileSync(resolve(tmpDir, '.kickstart/state.json'), 'not-json{{{');
    const result = JSON.parse(String(await invoke(tmpDir)));
    expect(result.found).toBe(false);
  });
});
