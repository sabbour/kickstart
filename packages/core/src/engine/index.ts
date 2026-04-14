export { Phase } from "./types.js";
export type {
  PhaseStatus,
  ConversationState,
  PhaseDefinition,
  ConversationEvent,
  Skill,
  SkillResolverContext,
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

export {
  resolveSkills,
  resolveSkillsAsync,
  resolveSkillsFromList,
  formatSkillsSection,
  registerSkillMiddleware,
} from "./skill-resolver.js";
export type { ResolvedSkills, SkillResolverMiddleware } from "./skill-resolver.js";

export {
  CopilotSkillsRegistry,
  defaultCopilotSkillsRegistry,
  AZURE_COPILOT_SKILLS,
  formatCopilotSkillsPrompt,
} from "./copilot-skills-registry.js";
export type { CopilotSkill, ResolvedCopilotSkills } from "./copilot-skills-registry.js";

export {
  resolveDataPath,
  resolveChainedPointer,
  interpolateTemplate,
  createDefaultValues,
  interpolateA2UIMessage,
  resolveBindings,
  analyzeSharedBindings,
} from "./data-binding.js";
export type {
  BindingDescriptor,
  ComponentBindingMap,
  SharedBindingAnalysis,
} from "./data-binding.js";

export {
  AUTO_CONTINUE_PREFIXES,
  AUTO_CONTINUE_MAX_CONSECUTIVE,
  shouldAutoContinue,
  synthesizeContinuationPrompt,
  synthesizeNavigationPrompt,
} from "./auto-continue.js";
