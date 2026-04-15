/**
 * @module @kickstart/core/engine/phases
 *
 * Phase definitions for the Kickstart conversation flow.
 * Six phases: DISCOVER → DESIGN → GENERATE → REVIEW (→ HANDOFF → DEPLOY, not yet implemented)
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
    entryConditions: [],
    exitConditions: [
      "appName is defined",
      "runtime is identified",
      "basic description is provided",
    ],
    promptTemplate: `Current known info:
{{knownInfo}}`,
    nextPhase: Phase.Design,
  },
  {
    id: Phase.Design,
    label: "Design",
    description:
      "Here's the architecture I recommend. I'll explain why each piece is there.",
    entryConditions: ["appName is defined", "runtime is identified"],
    exitConditions: [
      "services list is confirmed",
      "architecture diagram is accepted",
    ],
    promptTemplate: `Known app info:
{{knownInfo}}`,
    nextPhase: Phase.Generate,
  },
  {
    id: Phase.Generate,
    label: "Generate",
    description:
      "I'm generating the files you'll need. Here's what each one does.",
    entryConditions: [
      "services list is confirmed",
      "architecture diagram is accepted",
    ],
    exitConditions: [
      "deployment files are generated",
      "CI/CD workflow is generated",
    ],
    promptTemplate: `App definition:
{{appDefinition}}

Services:
{{services}}`,
    nextPhase: Phase.Review,
  },
  {
    id: Phase.Review,
    label: "Review",
    description:
      "Let's make sure your app runs great. Here's what I'd tune.",
    entryConditions: ["deployment files are generated"],
    exitConditions: [
      "user has approved the plan",
      "cost estimate is acknowledged",
    ],
    promptTemplate: `App definition:
{{appDefinition}}

Cost context:
{{costContext}}`,
    nextPhase: null,
  },
  {
    id: Phase.Handoff,
    label: "Handoff",
    description: "Your code is ready — let's get it into GitHub.",
    entryConditions: ["user has approved the plan"],
    exitConditions: [
      "repo is created or selected",
      "code is pushed",
      "codespace link is provided",
    ],
    promptTemplate: `App context:
{{appContext}}

Repo info:
{{repoInfo}}`,
    nextPhase: Phase.Deploy,
  },
  {
    id: Phase.Deploy,
    label: "Deploy",
    description: "Time to deploy. I'll guide you through each step.",
    entryConditions: ["repo is created or selected", "code is pushed"],
    exitConditions: ["deployment is initiated or skipped"],
    promptTemplate: `App context:
{{appContext}}

Deployment config:
{{deploymentConfig}}`,
    nextPhase: null,
  },
] as const;

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
