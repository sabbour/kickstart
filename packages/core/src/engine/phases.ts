/**
 * @module @kickstart/core/engine/phases
 *
 * Phase definitions for the Kickstart conversation flow.
 * Six phases: DISCOVER → DESIGN → GENERATE → REVIEW → HANDOFF → DEPLOY
 *
 * Phase templates are minimal context injections — behavioral instructions
 * live in the unified narrative prompt (system-prompt.ts).
 */

import { Phase } from "./types.js";
import type { PhaseDefinition } from "./types.js";

/** All phase definitions in conversation order. */
export const PHASE_DEFINITIONS: readonly PhaseDefinition[] = [
  {
    id: Phase.Discover,
    label: "Discover",
    description:
      "I'll suggest the best configuration based on your app. Just tell me what you're building.",
    nextPhase: Phase.Design,
  },
  {
    id: Phase.Design,
    label: "Design",
    description:
      "Here's the architecture I recommend. I'll explain why each piece is there.",
    nextPhase: Phase.Generate,
  },
  {
    id: Phase.Generate,
    label: "Generate",
    description:
      "I'm generating the files you'll need. Here's what each one does.",
    nextPhase: Phase.Review,
  },
  {
    id: Phase.Review,
    label: "Review",
    description:
      "Let's make sure your app runs great. Here's what I'd tune.",
    nextPhase: Phase.Handoff,
  },
  {
    id: Phase.Handoff,
    label: "Handoff",
    description: "Your code is ready — let's get it into GitHub.",
    nextPhase: Phase.Deploy,
  },
  {
    id: Phase.Deploy,
    label: "Deploy",
    description: "Time to deploy. I'll guide you through each step.",
    nextPhase: null,
  },
] as const;

/** Advance to the next phase, or return the same phase if already at the terminal phase. */
export function advancePhase(phase: Phase): Phase {
  return getPhaseDefinition(phase).nextPhase ?? phase;
}

/** Look up a phase definition by its ID. */
export function getPhaseDefinition(phase: Phase): PhaseDefinition {
  const def = PHASE_DEFINITIONS.find((p) => p.id === phase);
  if (!def) {
    throw new Error(`Unknown phase: ${phase}`);
  }
  return def;
}

/** Get the ordered list of phase IDs. */
export function getPhaseOrder(): Phase[] {
  return PHASE_DEFINITIONS.map((p) => p.id);
}
