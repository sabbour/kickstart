export { Phase } from "./types.js";
export type {
  PhaseStatus,
  ConversationState,
  PhaseDefinition,
  ConversationEvent,
} from "./types.js";

export {
  PHASE_DEFINITIONS,
  getPhaseDefinition,
  getPhaseOrder,
} from "./phases.js";

export {
  createInitialState,
  transition,
  getCurrentPhase,
  canAdvance,
} from "./machine.js";

export { resolveSkills, formatSkillsSection } from "./skill-resolver.js";
export type { ResolvedSkills } from "./skill-resolver.js";

export {
  resolveDataPath,
  interpolateTemplate,
  createDefaultValues,
  interpolateA2UIMessage,
} from "./data-binding.js";

export {
  AUTO_CONTINUE_PREFIXES,
  AUTO_CONTINUE_MAX_CONSECUTIVE,
  shouldAutoContinue,
  synthesizeContinuationPrompt,
  synthesizeNavigationPrompt,
} from "./auto-continue.js";
