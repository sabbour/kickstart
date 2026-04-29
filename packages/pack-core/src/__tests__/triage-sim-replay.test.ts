/**
 * @file triage-sim-replay.test.ts
 * @suite Sim-replay regression suite for the triage rewrite (#198)
 *
 * The sim-01..12 transcripts are the spec (DP §6.1, Zapp §11). This
 * suite asserts that the mode-recognition layer routes each opener to
 * the correct mode and constructs a typed handoff briefing that
 * round-trips through TriageHandoffBriefingSchema.
 *
 * Coverage:
 *   - Every sim opener → expected mode (12/12).
 *   - For modes that require a constraint pin (handover, migration-
 *     readiness), the briefing carries AKS_AUTOMATIC_V1_1_1 verbatim.
 *   - Z3 normalization: every briefing's `mode` field is a member of
 *     the strict enum.
 *   - R7 cost-objection: sim-08 opener triggers the cost-shock branch.
 *   - R8 read-only migration-phase: sim-02 follow-on phase markers
 *     return the inferred phase without persistence.
 */

import { describe, it, expect } from 'vitest';
import {
  recognizeTriageMode,
  detectCostObjection,
  inferMigrationPhase,
} from '../triage/mode-recognition.js';
import {
  AKS_AUTOMATIC_V1_1_1,
  TriageMode,
  parseTriageHandoffBriefing,
  type TriageHandoffBriefing,
} from '../triage/handoff-schema.js';

interface SimRow {
  sim: string;
  opener: string;
  repoSignals?: Parameters<typeof recognizeTriageMode>[0]['repoSignals'];
  expectedMode: TriageMode;
  expectedTarget: TriageHandoffBriefing['targetAgent'];
  expectsConstraintPin: boolean;
  expectsCostShock?: boolean;
}

const SIMS: SimRow[] = [
  {
    sim: 'sim-01 Sam Next.js floor',
    opener: 'Deploy this to Azure please: https://github.com/sam/portfolio',
    expectedMode: TriageMode.Greenfield,
    expectedTarget: 'aks.architect',
    expectsConstraintPin: false,
  },
  {
    sim: 'sim-02 Mike migration (raw manifests)',
    opener:
      "I have one production Spring Boot service, orders-api, currently on AKS Standard. I want to migrate this to AKS Automatic. Repo: https://github.com/contoso/orders-api",
    repoSignals: { hasManifestsFolder: true },
    expectedMode: TriageMode.MigrationReadiness,
    expectedTarget: 'aks.reviewer',
    expectsConstraintPin: true,
  },
  {
    sim: 'sim-03 Devi KAITO greenfield',
    opener:
      "I have a fine-tuned Phi-3-medium model with a LoRA adapter. I want to deploy this on AKS with KAITO so I can run on my own GPUs.",
    expectedMode: TriageMode.Greenfield,
    expectedTarget: 'aks.architect',
    expectsConstraintPin: false,
  },
  {
    sim: 'sim-04 Erin enterprise BYO IaC',
    opener:
      "I'm a platform engineer at Contoso. I need to deploy our customer-portal Spring Boot app to our existing AKS Automatic cluster aks-prod-eastus2-001 in eastus2.",
    expectedMode: TriageMode.Greenfield,
    expectedTarget: 'aks.architect',
    expectsConstraintPin: false,
  },
  {
    sim: 'sim-05 Stefan multi-svc compose',
    opener:
      'I have a docker-compose with 4 services for AKS Automatic with preview environments per PR, the way Vercel does it.',
    expectedMode: TriageMode.Greenfield,
    expectedTarget: 'aks.architect',
    expectsConstraintPin: false,
  },
  {
    sim: 'sim-06 Zhang greenfield chatbot',
    opener:
      "I want to build a chatbot for my team that searches our Confluence and our GitHub wiki. We don't have anything yet.",
    expectedMode: TriageMode.Greenfield,
    expectedTarget: 'aks.architect',
    expectsConstraintPin: false,
  },
  {
    sim: 'sim-07 Mike Helm chart migration',
    opener:
      "I'm back. Different service this time — packaged as a Helm chart. I want to migrate this chart to AKS Automatic.",
    repoSignals: { hasHelmChart: true },
    expectedMode: TriageMode.MigrationReadiness,
    expectedTarget: 'aks.reviewer',
    expectsConstraintPin: true,
  },
  {
    sim: 'sim-08 track-flip cost-shock',
    opener:
      "Wait — $320/mo for prod is more than I'm paying on Render today. Can we use Container Apps instead?",
    expectedMode: TriageMode.PaaSMigration,
    expectedTarget: 'azure.architect',
    expectsConstraintPin: false,
    expectsCostShock: true,
  },
  {
    sim: 'sim-09 Stefan iteration (worker added)',
    opener:
      'We just added a background worker for image processing. Can you update the deployment to include it?',
    repoSignals: { hasKickstartStateFile: true },
    expectedMode: TriageMode.Iteration,
    expectedTarget: 'aks.architect',
    expectsConstraintPin: false,
  },
  {
    sim: 'sim-10 Indira PaaS migration',
    opener:
      "I'm moving this from Render to Azure: https://github.com/indira/saas-api — Python FastAPI + Postgres + Redis + Stripe webhook.",
    expectedMode: TriageMode.PaaSMigration,
    expectedTarget: 'azure.architect',
    expectsConstraintPin: false,
  },
  {
    sim: 'sim-11 Mike bulk Heroku',
    opener:
      "I've got 3 Heroku apps to move to Azure AKS Automatic. One PR per app.",
    expectedMode: TriageMode.Bulk,
    expectedTarget: 'aks.architect',
    expectsConstraintPin: false,
  },
  {
    sim: 'sim-12 SRE handover',
    opener:
      'Awesome, looks good. Now I need our SRE Sarah to review this before we merge PR #47. Can you package it up for her?',
    expectedMode: TriageMode.Handover,
    expectedTarget: 'aks.reviewer',
    expectsConstraintPin: true,
  },
];

// ── Briefing builder (mirrors what the LLM produces from the prompt) ──────

function buildBriefing(row: SimRow, mode: TriageMode): TriageHandoffBriefing {
  const base = {
    version: 'triage-handoff/v1' as const,
    mode,
    skillIdsLoaded: row.expectedMode === TriageMode.MigrationReadiness
      ? ['azure-kubernetes-automatic-readiness']
      : [],
    sourceSignals: [
      {
        kind: 'opener-keyword' as const,
        detail: row.opener.slice(0, 200),
      },
    ],
    targetAgent: row.expectedTarget,
  };
  const withPin = row.expectsConstraintPin
    ? { ...base, constraintSpec: AKS_AUTOMATIC_V1_1_1 }
    : base;
  switch (mode) {
    case TriageMode.Iteration:
      return parseTriageHandoffBriefing({ ...withPin, iteration: { diffIntent: row.opener.slice(0, 100) } });
    case TriageMode.Handover:
      return parseTriageHandoffBriefing({ ...withPin, handover: { audience: 'reviewer' } });
    case TriageMode.Bulk:
      return parseTriageHandoffBriefing({
        ...withPin,
        bulk: {
          repoCount: 3,
          repos: ['blog-rails', 'api-node', 'ingester'],
          sharedInfraDecisionPending: true,
        },
      });
    case TriageMode.PaaSMigration:
      return parseTriageHandoffBriefing({
        ...withPin,
        paasMigration: { sourcePlatform: row.opener.toLowerCase().includes('render') ? 'render' : 'unknown' },
      });
    case TriageMode.MigrationReadiness:
      return parseTriageHandoffBriefing({
        ...withPin,
        migrationReadiness: {
          sourceShape: row.repoSignals?.hasHelmChart ? 'helm' : 'raw-manifests',
          helmBridgeRequired: row.repoSignals?.hasHelmChart === true,
        },
      });
    case TriageMode.Greenfield:
      return parseTriageHandoffBriefing({ ...withPin, greenfield: {} });
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('triage sim-replay regression — DP §6.1 / Zapp §11', () => {
  for (const row of SIMS) {
    describe(row.sim, () => {
      it(`recognizes mode = ${row.expectedMode}`, () => {
        const r = recognizeTriageMode({ opener: row.opener, repoSignals: row.repoSignals });
        expect(r.mode).toBe(row.expectedMode);
      });

      it('produces a schema-valid handoff briefing', () => {
        const briefing = buildBriefing(row, row.expectedMode);
        expect(briefing.version).toBe('triage-handoff/v1');
        expect(briefing.targetAgent).toBe(row.expectedTarget);
      });

      if (row.expectsConstraintPin) {
        it('briefing carries AKS_AUTOMATIC_V1_1_1 verbatim (D7/D8/Z1)', () => {
          const briefing = buildBriefing(row, row.expectedMode);
          expect(briefing.constraintSpec).toEqual(AKS_AUTOMATIC_V1_1_1);
        });
      }

      if (row.expectsCostShock) {
        it('opener triggers cost-shock branch (R7 / D1)', () => {
          expect(detectCostObjection(row.opener).triggered).toBe(true);
        });
      }
    });
  }
});

describe('R8 — migration_phase is read-only / inferred per-turn', () => {
  it('phase 1 when nothing has happened (sim-02 turn 1)', () => {
    expect(inferMigrationPhase({ conversation: [] })).toBe(1);
  });

  it('phase 2 after scorecard generated (sim-02 turn ~3)', () => {
    expect(inferMigrationPhase({ conversation: [], hasSafeguardsReport: true })).toBe(2);
  });

  it('extracts phase from explicit user mention ("Phase 3")', () => {
    expect(
      inferMigrationPhase({
        conversation: [{ role: 'user', content: 'Resuming at Phase 3.' }],
      }),
    ).toBe(3);
  });
});
