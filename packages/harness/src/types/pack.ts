import type { AgentContribution } from './agent.js';
import type { ComponentContribution } from './component.js';
import type { GuardrailContribution } from './guardrail.js';
import type { PlaygroundScenario } from './playground.js';
import type { Skill } from './skill.js';
import type { ToolContribution } from './tool.js';
import type { UserActionContribution } from './user-action.js';

export type PlaygroundStub = (args: unknown) => Promise<unknown>;

export interface Pack {
  name: string;
  version: string;
  dependsOn?: string[];
  /**
   * Packs whose agents this pack may hand off to, without declaring a full
   * dependency. Unlike `dependsOn`, entries here are NOT traversed by
   * `assertNoCycles()` and do not grant tool or user-action trust — they
   * only widen the allowed handoff targets checked by `validateHandoffs()`.
   */
  handoffTargets?: string[];
  agentsDir?: URL;
  agents?: AgentContribution[];   // inline agent registrations (no .md file required)
  skillsDir?: URL;
  skills?: Skill[];          // inline skill registrations (no .md file required)
  tools?: ToolContribution[];
  userActions?: UserActionContribution[];
  components?: ComponentContribution[];
  guardrails?: GuardrailContribution[];
  playgroundScenarios?: PlaygroundScenario[];
  playgroundStubs?: Record<string, PlaygroundStub>;
}
