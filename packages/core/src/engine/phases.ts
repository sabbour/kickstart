/**
 * @module @kickstart/core/engine/phases
 *
 * Phase definitions for the Kickstart conversation flow.
 * Each phase defines entry/exit conditions and an LLM prompt template.
 */

import { Phase } from "./types.js";
import type { PhaseDefinition } from "./types.js";

/** All phase definitions in conversation order. */
export const PHASE_DEFINITIONS: readonly PhaseDefinition[] = [
  {
    id: Phase.Understand,
    label: "Understand",
    description: "Tell me about your application — what are you building?",
    entryConditions: [],
    exitConditions: [
      "appName is defined",
      "runtime is identified",
      "basic description is provided",
    ],
    promptTemplate: `You are Kickstart, an AI assistant that helps developers deploy applications to Azure Kubernetes Service (AKS).

You are in the UNDERSTAND phase. Your goal is to learn about the user's application.

Ask about:
- What the application does (brief description)
- What language/runtime it uses (Node.js, Python, .NET, Java, Go, Rust, or static)
- Whether it has a Dockerfile already
- What port it listens on

Be conversational and encouraging. If the user is unsure, suggest common defaults.
Do NOT ask about Azure resources yet — that comes in a later phase.

Current known info:
{{knownInfo}}`,
    nextPhase: Phase.Clarify,
  },
  {
    id: Phase.Clarify,
    label: "Clarify",
    description: "Let me clarify a few details about your setup.",
    entryConditions: [
      "appName is defined",
      "runtime is identified",
    ],
    exitConditions: [
      "port is defined",
      "database requirements are known",
      "ingress requirements are known",
    ],
    promptTemplate: `You are Kickstart, an AI assistant helping deploy apps to AKS.

You are in the CLARIFY phase. The user has described their app. Now fill in the gaps.

Ask about:
- Database needs (PostgreSQL, MySQL, MongoDB, Redis, Cosmos DB, or none)
- Whether it needs a public endpoint (ingress)
- Environment variables it requires
- Any custom domain

Keep questions focused. If the user already provided info, acknowledge it and move on.

Known app info:
{{knownInfo}}`,
    nextPhase: Phase.Needs,
  },
  {
    id: Phase.Needs,
    label: "Azure Resources",
    description: "Let's figure out what Azure resources you need.",
    entryConditions: [
      "app requirements are fully captured",
    ],
    exitConditions: [
      "subscription is selected",
      "resource group is selected",
      "region is selected",
    ],
    promptTemplate: `You are Kickstart, an AI assistant helping deploy apps to AKS.

You are in the NEEDS phase. Help the user select Azure resources.

Guide them through:
- Selecting an Azure subscription
- Choosing or creating a resource group
- Picking an Azure region
- Selecting a resource tier (dev/standard/production)

Explain the cost implications of each tier briefly.
Use the ResourcePicker component for selection UI.

Known context:
{{knownInfo}}`,
    nextPhase: Phase.Plan,
  },
  {
    id: Phase.Plan,
    label: "Generate Plan",
    description: "Generating your deployment artifacts and plan.",
    entryConditions: [
      "Azure context is complete",
      "app definition is complete",
    ],
    exitConditions: [
      "manifests are generated",
      "deployment plan is presented",
    ],
    promptTemplate: `You are Kickstart, an AI assistant helping deploy apps to AKS.

You are in the PLAN phase. Generate the deployment plan.

Produce:
- Kubernetes manifests (Deployment, Service, Ingress)
- GitHub Actions workflow for CI/CD
- Architecture diagram (Mermaid)
- Cost estimate
- Handoff card with link to Codespaces or vscode.dev

Present each artifact with a CodeBlock component.
Show the overall architecture with an ArchitectureDiagram component.
Show estimated costs with a CostEstimate component.

App definition:
{{appDefinition}}

Azure context:
{{azureContext}}`,
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
