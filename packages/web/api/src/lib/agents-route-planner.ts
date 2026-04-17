/**
 * @module @kickstart/api/lib/agents-route-planner
 *
 * Code-owned route planner — the server's conversation control plane.
 *
 * Replaces `phaseComplete`/`filesComplete` model flags as the authority for
 * phase advancement and deployment selection. Route policy lives here in
 * product code, not in the LLM's JSON output.
 *
 * Lanes map 1:1 to phases but are named independently so they can be
 * refactored without touching the Phase enum.
 */

import { Phase, advancePhase } from "@kickstart/core";
import type { ApiSession } from "./session-store.js";

/** Routing lane — one per conversation phase. */
export type RouteLane =
  | "discover"
  | "design"
  | "generate"
  | "review"
  | "handoff"
  | "deploy";

/** Immutable routing decision for a single turn. */
export interface RoutePlan {
  /** The current lane (maps to Phase). */
  lane: RouteLane;
  /** Azure deployment to use for this turn. */
  deployment: string;
  /** Billing group for usage tracking. */
  pricingGroup: "chat" | "generate";
  /** Whether the server considers this phase complete and will advance after this turn. */
  shouldAdvancePhase: boolean;
  /** Whether to signal auto-continue for file generation. */
  shouldAutoContinue: boolean;
}

const PHASE_TO_LANE: Record<Phase, RouteLane> = {
  [Phase.Discover]: "discover",
  [Phase.Design]: "design",
  [Phase.Generate]: "generate",
  [Phase.Review]: "review",
  [Phase.Handoff]: "handoff",
  [Phase.Deploy]: "deploy",
};

/**
 * Plan the routing for a single conversation turn.
 *
 * The route planner consults:
 * - The current server-owned phase (never trusts client phase claims)
 * - The `routingPhaseTrusted` flag on the session
 * - Model output flags extracted from the previous LLM response (advisory only)
 *
 * @param session - The server session (phase is always authoritative from here)
 * @param llmFlags - Advisory flags from the LLM response (phaseComplete, filesComplete)
 * @param deployments - Deployment names for chat and generate routes
 */
export function planRoute(
  session: ApiSession,
  llmFlags: { phaseComplete?: boolean; filesComplete?: boolean | null },
  deployments: { chat: string; generate: string },
): RoutePlan {
  const phase = toSafePhase(session.state.currentPhase);
  const lane = PHASE_TO_LANE[phase];

  // Generate lane always uses codex/generate deployment when routing is trusted
  const isGenerateTurn =
    phase === Phase.Generate && session.routingPhaseTrusted;

  const deployment = isGenerateTurn ? deployments.generate : deployments.chat;
  const pricingGroup: "chat" | "generate" = isGenerateTurn ? "generate" : "chat";

  // Phase advancement: server decides based on LLM advisory flag.
  // Future: replace with server-side heuristics (turn count, artifact count, etc.)
  const shouldAdvancePhase = llmFlags.phaseComplete === true;

  // Auto-continue: advisory from LLM (filesComplete: false means more files pending)
  const shouldAutoContinue = llmFlags.filesComplete === false;

  return {
    lane,
    deployment,
    pricingGroup,
    shouldAdvancePhase,
    shouldAutoContinue,
  };
}

/**
 * Apply route plan side-effects to the session:
 * advance phase if the plan says so.
 */
export function applyRoutePlan(session: ApiSession, plan: RoutePlan): void {
  if (plan.shouldAdvancePhase) {
    // Normalise to a known Phase before advancing — an invalid stored value
    // would crash advancePhase/getPhaseDefinition. Write the safe value back
    // so the session stays consistent.
    const currentPhase = toSafePhase(session.state.currentPhase);
    session.state.currentPhase = currentPhase;
    session.state.currentPhase = advancePhase(currentPhase);
  }
}

/** Map a phase string to Phase enum, failing closed to Discover. */
export function toSafePhase(phase: string | Phase): Phase {
  const knownPhases = new Set<string>(Object.values(Phase));
  return knownPhases.has(phase as Phase) ? (phase as Phase) : Phase.Discover;
}
