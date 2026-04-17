import type { Tool as SDKTool } from '@openai/agents';

export interface ToolContribution {
  name: string;
  tool: SDKTool;
  /** When true, tool appears in MCP tool manifest. Default: false (opt-in only). */
  mcpExposed?: boolean;
  /** When true, tool requires an active user session — excluded from MCP manifest entirely. */
  requiresSession?: boolean;
}
