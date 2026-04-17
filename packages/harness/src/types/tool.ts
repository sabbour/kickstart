import type { Tool as SDKTool } from '@openai/agents';

export interface ToolContribution {
  name: string;
  tool: SDKTool;
  mcpExposed?: boolean;
}
