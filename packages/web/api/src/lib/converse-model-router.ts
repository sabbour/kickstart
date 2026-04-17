import { Phase } from "@kickstart/harness";
import {
  getChatDeploymentName,
  getGenerateDeploymentName,
} from "./openai-client.js";

export interface ConverseModelRoute {
  deployment: string;
  model: string;
  pricingGroup: "chat" | "generate";
}

const KNOWN_PHASES = new Set(Object.values(Phase));

/** Normalize runtime phase values so unknown input fails closed. */
export function normalizeConversePhase(
  phase: string | null | undefined,
): Phase | undefined {
  if (!phase) return undefined;
  return KNOWN_PHASES.has(phase as Phase) ? (phase as Phase) : undefined;
}

/**
 * Route real converse traffic by trusted server phase.
 * Trusted Generate turns use the coding deployment (for example gpt-5.4);
 * every other turn — including client-rehydrated phases — fails closed to the
 * chat deployment (for example gpt-5.4-mini).
 */
export function resolveConverseModelRoute(
  phase: string | null | undefined,
  options: { trustedPhase?: boolean } = {},
): ConverseModelRoute {
  if (options.trustedPhase && normalizeConversePhase(phase) === Phase.Generate) {
    const model = getGenerateDeploymentName();
    return { deployment: model, model, pricingGroup: "generate" };
  }

  const model = getChatDeploymentName();
  return { deployment: model, model, pricingGroup: "chat" };
}
