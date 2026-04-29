/**
 * Triage Mode Recognition (#198)
 * ===============================
 *
 * The classifier that runs BEFORE track selection. Six modes,
 * first-match-wins, with documented precedence rationale.
 *
 *   Iteration > Handover > Bulk > PaaS-migration > Migration-readiness > Greenfield
 *
 * Why this order (Nibbler R1 — "first match wins is the contract"):
 *
 *   1. Iteration always pre-empts. The user is mid-flight on a prior plan;
 *      every other signal (Heroku mention, charts/ folder, etc.) is about
 *      a NEW workload. .kickstart/state.json presence + iteration-tells in
 *      the opener trump everything else.
 *   2. Handover is a meta-action ("review for X", "package for Y") that can
 *      look like any other mode at the surface level. We take it before
 *      Bulk so a sentence like "package these 3 services for Sarah" is a
 *      handover, not a bulk migration.
 *   3. Bulk pre-empts PaaS-migration: "3 Heroku apps" is bulk-shaped; the
 *      shared-infra-decision opening is mandatory before per-app inspection
 *      (sim-11 invariant). PaaS-migration handles the n=1 case.
 *   4. PaaS-migration before Migration-readiness because PaaS markers
 *      (Render/Heroku/Vercel/Fly/Netlify/Railway) are about source
 *      platform; migration-readiness is about Kubernetes-source-shape
 *      (manifests/Helm/Kustomize). PaaS is upstream of K8s readiness.
 *   5. Migration-readiness before Greenfield because charts/ or k8s/ in the
 *      repo is a strong signal it's NOT a greenfield run.
 *   6. Greenfield is the catch-all.
 *
 * Output is the normalized TriageMode enum — never raw user prose
 * (Zapp Z3). This module is pure-functional + deterministic; opener
 * length is bounded to defend against regex-DoS (Zapp DoS column).
 *
 * Note on R7 (cost-shock branch): cost-objection is detected separately
 * by `detectCostObjection` and does NOT collapse into one of the six modes
 * — it's a per-turn branch on top of an existing mode. This file owns
 * both functions for symmetry; cost-shock is documented as semantic
 * intent + illustrative regex examples (R7), not gating regex.
 */

import { TriageMode } from './handoff-schema.js';

// Defence against regex-heavy input (Zapp DoS column, threat model row 5).
const MAX_OPENER_CHARS = 8_192;

/**
 * Repo-shape signals callers can pass in once they have run
 * `core.inspect_repo`. None of the per-turn classifier functions are
 * required to wait for inspect — modes #1, #2, #3, #4 are detectable from
 * opener text alone.
 */
export interface RepoSignals {
  hasKickstartStateFile?: boolean;
  hasHelmChart?: boolean;
  hasKustomization?: boolean;
  hasManifestsFolder?: boolean;
}

export interface RecognizeModeInput {
  opener: string;
  repoSignals?: RepoSignals;
}

export interface RecognizeModeResult {
  mode: TriageMode;
  reason: string;
}

const RX = {
  // Iteration tells: "update the deployment", "add a worker", "we just
  // added X", "modify the cluster" — all refer to a PRIOR plan.
  iteration: /\b(update the (deployment|cluster|chart|manifests?|workload)|add(ed|ing)? (a|the|another) (worker|service|job|cron|queue)|we just (added|shipped|deployed)|modify the existing|change the prior)\b/i,
  // Handover: "package up", "send to X", "review pack", "for review",
  // "before we merge", "PR #N review", "hand this off to <name>".
  handover: /\b(package (it|this|that|them) up|hand(ing|ed)? this off|review pack|for (sre|ops|security)? ?review|before (we|i) merge|review this (for|with) (her|him|them|\w+))\b/i,
  // Bulk: "3 apps", "5 services", "these 4 repos", numeric phrases that
  // imply a multi-workload spread.
  bulk: /\b(\d+) (heroku|render|vercel|node|spring|rails|python|go) (apps?|services?|workers?|repos?|projects?)\b/i,
  // PaaS markers — anchored to "from <platform>", "on <platform>", or
  // "currently <platform>" so an incidental mention doesn't fire.
  paas: /\b(from|on|off|currently on|moving (this )?off|migrating from)\s+(render|heroku|vercel|fly\.io|fly|netlify|railway)\b/i,
  // K8s migration shape: "migrate to AKS Automatic", "move my cluster",
  // "switch to AKS Automatic" — the source is already Kubernetes-shaped.
  migration: /\b(migrate (this|my|our|the).*(to)?\s*aks( automatic)?|move (this|my) (cluster|workload|chart|service)|switch.*aks( automatic)?|(?:from )?aks standard|chart.*(?:to)\s*aks)\b/i,
} as const;

/**
 * Cost-objection — Nibbler R7. Reframed as semantic intent: the LLM is
 * the gating predicate, regex examples are *illustrative* only. We export
 * the regex set so the prompt can cite it as "if you see ANY of these or
 * paraphrases" — never as a literal matcher.
 */
export const COST_OBJECTION_EXAMPLES: readonly RegExp[] = [
  /\$\s*\d+\s*\/?\s*(mo|mth|month|yr|year)?\b[^.\n]{0,80}?\b(is (a lot|too much|expensive)|is more than|more than (i'?m|we'?re) paying)/i,
  /more than (i'?m|we'?re) paying/i,
  /(too )?(pricey|expensive|costly)/i,
  /can we (use|do this on|run on) (a )?(cheaper|budget|free|hobby)/i,
  /scales? to zero/i,
  /(vercel|render|heroku|fly|netlify|railway)-(like|equivalent|style)/i,
  /what'?s the (floor|minimum|cheapest)/i,
  /enterprise rates|enterprise pricing/i,
  /budget (concern|constraint|cap)/i,
];

export interface CostObjectionResult {
  triggered: boolean;
  reason: string;
}

/**
 * Reference matcher used by the sim-replay regression suite to assert
 * coverage on real cost-objection paraphrases. The LLM in production
 * uses semantic intent (R7); this helper exists so unit tests can
 * confirm the EXAMPLE SET in the prompt is at least adequate for the
 * sim corpus and known paraphrases.
 */
export function detectCostObjection(text: string): CostObjectionResult {
  if (!text) return { triggered: false, reason: 'empty input' };
  const bounded = text.slice(0, MAX_OPENER_CHARS);
  for (const rx of COST_OBJECTION_EXAMPLES) {
    if (rx.test(bounded)) {
      return { triggered: true, reason: `matched ${rx}` };
    }
  }
  return { triggered: false, reason: 'no cost-objection example matched' };
}

/**
 * The mode classifier. Pure function. Output is one of the six normalized
 * TriageMode values + a structured reason string (never raw user text).
 */
export function recognizeTriageMode(input: RecognizeModeInput): RecognizeModeResult {
  const opener = (input.opener ?? '').slice(0, MAX_OPENER_CHARS);
  const repo = input.repoSignals ?? {};

  // 1. Iteration — opener tells OR .kickstart/state.json present.
  if (repo.hasKickstartStateFile === true) {
    return { mode: TriageMode.Iteration, reason: 'kickstart-state-file present' };
  }
  if (RX.iteration.test(opener)) {
    return { mode: TriageMode.Iteration, reason: 'iteration phrasing in opener' };
  }

  // 2. Handover — meta-action over any other content shape.
  if (RX.handover.test(opener)) {
    return { mode: TriageMode.Handover, reason: 'handover phrasing in opener' };
  }

  // 3. Bulk — explicit "N apps/services/repos" before PaaS markers.
  if (RX.bulk.test(opener)) {
    return { mode: TriageMode.Bulk, reason: 'bulk count phrasing in opener' };
  }

  // 4. PaaS migration — n=1 case, source platform mentioned.
  if (RX.paas.test(opener)) {
    return { mode: TriageMode.PaaSMigration, reason: 'paas marker in opener' };
  }

  // 5. Migration-readiness — repo-shape (charts/, k8s/) OR migration verbs.
  if (repo.hasHelmChart === true || repo.hasKustomization === true || repo.hasManifestsFolder === true) {
    return { mode: TriageMode.MigrationReadiness, reason: 'kubernetes-source-shape in repo' };
  }
  if (RX.migration.test(opener)) {
    return { mode: TriageMode.MigrationReadiness, reason: 'migration phrasing in opener' };
  }

  // 6. Greenfield catch-all.
  return { mode: TriageMode.Greenfield, reason: 'no specialized signal' };
}

/**
 * Nibbler R8 — `migration_phase` ownership clarification (read-only).
 *
 * Triage is stateless across handoffs and has NO write tool. This helper
 * INFERS migration_phase from the conversation history + opener; it never
 * persists. Persistence, when needed, is `aks.reviewer`'s lane via
 * safeguards-report.md.
 *
 * Phase definitions (per AKS Automatic grounding Part 12):
 *   1 = inspect / scorecard not yet generated
 *   2 = scorecard generated, fixes not yet applied
 *   3 = fixes applied, ready for cluster spin
 *   4 = cluster live, deployment in progress
 */
export type MigrationPhase = 1 | 2 | 3 | 4;

export function inferMigrationPhase(opts: {
  conversation: ReadonlyArray<{ role: string; content: string }>;
  hasSafeguardsReport?: boolean;
  hasFixesApplied?: boolean;
  hasClusterLive?: boolean;
}): MigrationPhase {
  if (opts.hasClusterLive) return 4;
  if (opts.hasFixesApplied) return 3;
  if (opts.hasSafeguardsReport) return 2;
  // Phase markers in conversation history: "Phase 2", "Phase 3", "Phase 4".
  const all = opts.conversation.map((m) => m.content).join('\n');
  const m = /\bphase\s*([1-4])\b/i.exec(all);
  if (m) return Number(m[1]) as MigrationPhase;
  return 1;
}
