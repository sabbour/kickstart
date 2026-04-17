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

const KNOWN_PHASE_SET = new Set<string>(Object.values(Phase));

/** Type guard — returns true when `s` is a valid Phase enum value. */
export function isPhase(s: string): s is Phase {
  return KNOWN_PHASE_SET.has(s);
}

/**
 * Advance to the next phase.
 * Accepts any string; unrecognised values fall back to Phase.Discover
 * rather than throwing so stale/hydrated phase strings never crash callers.
 */
export function advancePhase(phase: Phase | string): Phase {
  const def = PHASE_DEFINITIONS.find((p) => p.id === phase);
  if (!def) return Phase.Discover;
  return def.nextPhase ?? (phase as Phase);
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
