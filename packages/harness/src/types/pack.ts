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
  agentsDir?: URL;
  skillsDir?: URL;
  agents?: AgentContribution[];
  skills?: Skill[];
  tools?: ToolContribution[];
  userActions?: UserActionContribution[];
  components?: ComponentContribution[];
  guardrails?: GuardrailContribution[];
  playgroundScenarios?: PlaygroundScenario[];
  playgroundStubs?: Record<string, PlaygroundStub>;
}
