export { Phase } from "./types.js";
export type {
  PhaseDefinition,
  Skill,
} from "./types.js";

export {
  PHASE_DEFINITIONS,
  getPhaseDefinition,
  getPhaseOrder,
  advancePhase,
  isPhase,
} from "./phases.js";

export { resolveSkills } from "./skill-resolver.js";
export type { ResolvedSkills } from "./skill-resolver.js";

export {
  DOCKER_KEYWORDS,
  DOCKER_PATTERNS,
  isDockerRelated,
  AKS_KEYWORDS,
  AKS_PATTERNS,
  isAKSRelated,
  CICD_KEYWORDS,
  CICD_PATTERNS,
  isCICDRelated,
  AUTH_KEYWORDS,
  AUTH_PATTERNS,
  isAuthRelated,
  DATABASE_KEYWORDS,
  DATABASE_RELATIONAL_PATTERNS,
  isDatabaseRelated,
} from "./skill-vocabulary.js";

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
