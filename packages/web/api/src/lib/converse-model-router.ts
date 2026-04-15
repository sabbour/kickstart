import { Phase } from "@kickstart/core";
import { getChatDeploymentName, getCodexDeploymentName } from "./openai-client.js";

export interface ConverseModelRoute {
  deployment: string;
  model: string;
}

const KNOWN_PHASES = new Set(Object.values(Phase));

/** Normalize runtime phase values so unknown input fails closed. */
export function normalizeConversePhase(
  phase: string | null | undefined,
): Phase | undefined {
  if (!phase) return undefined;
  return KNOWN_PHASES.has(phase as Phase) ? (phase as Phase) : undefined;
}

/** Route converse requests by trusted server phase. */
export function resolveConverseModelRoute(
  phase: string | null | undefined,
  options: { trustedPhase?: boolean } = {},
): ConverseModelRoute {
  if (options.trustedPhase && normalizeConversePhase(phase) === Phase.Generate) {
    const model = getCodexDeploymentName();
    return { deployment: model, model };
  }

  const model = getChatDeploymentName();
  return { deployment: model, model };
}
