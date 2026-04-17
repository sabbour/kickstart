/**
 * @module @kickstart/harness/mcp/client
 *
 * Harness-side MCP client stub.
 *
 * TODO(Step 12+): Implement MCP client for agent-to-agent communication.
 * This allows harness-hosted agents to connect to external MCP servers and
 * use their tools through the same ToolContribution interface.
 *
 * Deferred — not required for Step 12 server adapter.
 */

export type McpClientConfig = {
  /** Transport type — stdio or http-sse */
  transport: 'stdio' | 'http-sse';
  /** Command to launch for stdio transport */
  command?: string;
  /** Args for stdio command */
  args?: string[];
  /** Base URL for http-sse transport */
  url?: string;
};

/**
 * Deferred stub — not yet implemented.
 * Will be wired in a future step to allow agents to call external MCP servers.
 */
export class McpClient {
  constructor(_config: McpClientConfig) {
    // TODO(Step 12+): Connect to external MCP server and enumerate its tools
    // as ToolContributions that the registry can inject into agents.
    throw new Error('McpClient is not yet implemented. Deferred to a future step.');
  }
}
