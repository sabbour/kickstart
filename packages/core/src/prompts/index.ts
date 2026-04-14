/**
 * @module @kickstart/core/prompts
 *
 * Public API for the Kickstart prompt system (Layer 2 + composition).
 */

export {
  KICKSTART_SYSTEM_PROMPT,
  DEPLOYMENT_SAFEGUARDS,
  buildSystemPrompt,
  sanitizePromptValue,
} from "./system-prompt.js";

export type {
  DeploymentSafeguard,
  SafeguardSeverity,
  SystemPromptContext,
} from "./system-prompt.js";
