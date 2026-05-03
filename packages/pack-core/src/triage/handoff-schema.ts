/**
 * Triage Handoff Briefing Schema v1
 * =================================
 *
 * Source decisions:
 *   D7 — handover & migration-readiness route to aks.reviewer (Phase 1.6
 *        consensus, AKS Automatic grounding Part 12).
 *   D8 — Microsoft skills loaded via core.read_skill; constraint-spec
 *        v1.1.1 (AKS 2026-03-15) is the canonical safeguard pin.
 *   Z1 (Zapp DR) — typed handoff tripwire for v1.1.1 metadata: every
 *        triage handoff path that targets readiness/handover flows MUST
 *        carry the constraint-spec version + skill ids in a typed slot
 *        (not in free prose).
 *   Z2 (Zapp DR) — CI enforcement gate: every downstream agent prompt
 *        that consumes a triage handoff is verified to reference the
 *        typed slot, not raw user text.
 *   Z3 (Zapp DR) — classifier output normalization: the recognized mode
 *        is a fixed enum, never raw user prose.
 *   R5 (Nibbler) — define a one-page "Handoff Briefing Schema v1" so
 *        five downstream prompts don't re-derive the format and silently
 *        drift on version-pin shape.
 */

import { z } from 'zod';

// ── Z3: Mode classifier output (normalized enum, never raw user text) ───────

export const TriageMode = {
  Iteration: 'iteration',
  Handover: 'handover',
  Bulk: 'bulk',
  PaaSMigration: 'paas-migration',
  MigrationReadiness: 'migration-readiness',
  Greenfield: 'greenfield',
} as const;

export type TriageMode = (typeof TriageMode)[keyof typeof TriageMode];

export const TriageModeSchema = z.enum([
  TriageMode.Iteration,
  TriageMode.Handover,
  TriageMode.Bulk,
  TriageMode.PaaSMigration,
  TriageMode.MigrationReadiness,
  TriageMode.Greenfield,
]);

// ── D8 / Z1: Constraint-spec pin ────────────────────────────────────────────

export const ConstraintSpecPinSchema = z
  .object({
    safeguardSpecVersion: z
      .string()
      .regex(/^v\d+\.\d+\.\d+$/, 'safeguardSpecVersion must be v<MAJOR>.<MINOR>.<PATCH>'),
    aksVersion: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'aksVersion must be YYYY-MM-DD'),
  })
  .strict();

export type ConstraintSpecPin = z.infer<typeof ConstraintSpecPinSchema>;

export const AKS_AUTOMATIC_V1_1_1: ConstraintSpecPin = {
  safeguardSpecVersion: 'v1.1.1',
  aksVersion: '2026-03-15',
};

// ── Source signals ──────────────────────────────────────────────────────────

const SourceSignalSchema = z
  .object({
    kind: z.enum([
      'opener-keyword',
      'inspect-repo',
      'kickstart-state-file',
      'helm-chart-detected',
      'manifest-folder-detected',
      'paas-marker',
      'multi-repo-list',
      'handover-marker',
      'cost-objection',
    ]),
    detail: z.string().min(1).max(512),
  })
  .strict();

export type SourceSignal = z.infer<typeof SourceSignalSchema>;

// ── Phase 3: Prior deployment context (#218) ────────────────────────────────
//
// Extracted from `.kickstart/state.json` by `core.priorDeploymentContext` and
// placed in the iteration block. Allows the triage agent to skip redundant
// questions and go straight to iteration mode when a prior deployment exists.

export const PriorDeploymentContextSchema = z
  .object({
    lastRecipe: z.string().min(1).max(256),
    lastHandoffTarget: z.string().min(1).max(128),
    workspaceStateFile: z.string().min(1),
    summary: z.string().min(1).max(1024),
  })
  .strict();

export type PriorDeploymentContext = z.infer<typeof PriorDeploymentContextSchema>;

// ── Mode-specific context blocks ────────────────────────────────────────────

const IterationContextSchema = z
  .object({
    priorPlanRef: z.string().min(1).optional(),
    diffIntent: z.string().min(1).max(512),
    priorDeploymentContext: PriorDeploymentContextSchema.optional(),
  })
  .strict();

const HandoverContextSchema = z
  .object({
    audience: z.string().min(1).max(128),
    artifactsPath: z.string().min(1).optional(),
  })
  .strict();

const BulkContextSchema = z
  .object({
    repoCount: z.number().int().min(2),
    repos: z.array(z.string().min(1)).min(2),
    sharedInfraDecisionPending: z.boolean(),
  })
  .strict();

const PaaSMigrationContextSchema = z
  .object({
    sourcePlatform: z.enum([
      'render',
      'heroku',
      'vercel',
      'fly',
      'netlify',
      'railway',
      'unknown',
    ]),
    sourceUrl: z.string().min(1).optional(),
  })
  .strict();

const MigrationReadinessContextSchema = z
  .object({
    sourceShape: z.enum(['raw-manifests', 'helm', 'kustomize', 'mixed']),
    helmBridgeRequired: z.boolean(),
  })
  .strict();

const GreenfieldContextSchema = z
  .object({
    track: z
      .enum(['static_site', 'containerized_web', 'agentic_app', 'repo_uplift'])
      .optional(),
  })
  .strict();

// ── Top-level briefing schema ───────────────────────────────────────────────

export const TriageHandoffBriefingSchema = z
  .object({
    version: z.literal('triage-handoff/v1'),
    mode: TriageModeSchema,
    constraintSpec: ConstraintSpecPinSchema.optional(),
    skillIdsLoaded: z.array(z.string().min(1)).default([]),
    sourceSignals: z.array(SourceSignalSchema).min(1).max(16),
    targetAgent: z.enum([
      'aks.architect',
      'aks.reviewer',
      'azure.architect',
      'github.publisher',
      'core.codesmith',
      'core.reviewer',
    ]),
    iteration: IterationContextSchema.optional(),
    handover: HandoverContextSchema.optional(),
    bulk: BulkContextSchema.optional(),
    paasMigration: PaaSMigrationContextSchema.optional(),
    migrationReadiness: MigrationReadinessContextSchema.optional(),
    greenfield: GreenfieldContextSchema.optional(),
  })
  .strict()
  .refine(
    (b) => {
      if (b.mode === TriageMode.Handover || b.mode === TriageMode.MigrationReadiness) {
        return b.constraintSpec !== undefined;
      }
      return true;
    },
    {
      message:
        'constraintSpec is REQUIRED for handover and migration-readiness modes (Zapp Z1 / D7 / D8). ' +
        'Set constraintSpec: AKS_AUTOMATIC_V1_1_1.',
      path: ['constraintSpec'],
    },
  )
  .refine(
    (b) => {
      const map: Record<TriageMode, keyof typeof b> = {
        iteration: 'iteration',
        handover: 'handover',
        bulk: 'bulk',
        'paas-migration': 'paasMigration',
        'migration-readiness': 'migrationReadiness',
        greenfield: 'greenfield',
      };
      const expected = map[b.mode];
      const blocks: Array<keyof typeof b> = [
        'iteration',
        'handover',
        'bulk',
        'paasMigration',
        'migrationReadiness',
        'greenfield',
      ];
      const populated = blocks.filter((k) => b[k] !== undefined);
      return populated.length === 1 && populated[0] === expected;
    },
    {
      message:
        'Exactly one mode-specific context block must be populated, and it must match the `mode` field.',
    },
  )
  .refine(
    (b) => {
      if (b.mode === TriageMode.MigrationReadiness) {
        return b.skillIdsLoaded.includes('azure-kubernetes-automatic-readiness');
      }
      return true;
    },
    {
      message:
        'migration-readiness mode MUST load `azure-kubernetes-automatic-readiness` ' +
        '(D8). Add it to skillIdsLoaded.',
      path: ['skillIdsLoaded'],
    },
  );

export type TriageHandoffBriefing = z.infer<typeof TriageHandoffBriefingSchema>;

export function parseTriageHandoffBriefing(input: unknown): TriageHandoffBriefing {
  return TriageHandoffBriefingSchema.parse(input);
}
