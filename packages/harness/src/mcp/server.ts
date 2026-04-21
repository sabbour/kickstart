/**
 * @module @aks-kickstart/harness/mcp/server
 *
 * Harness-side MCP server utilities.
 *
 * Provides the manifest-building and client-detection primitives that the
 * @aks-kickstart/mcp-server thin adapter uses. All filtering policy lives here so
 * it can be unit-tested without spinning up the full MCP transport layer.
 */

import type { PackRegistry } from '../runtime/registry.js';
import type { ToolContribution } from '../types/tool.js';
import type { FunctionTool } from '@openai/agents';

// ---------------------------------------------------------------------------
// Client detection
// ---------------------------------------------------------------------------

/**
 * Return true when the MCP client is VS Code (GitHub Copilot in VS Code).
 *
 * Checked against `clientInfo.name` from the MCP `initialize` handshake.
 * Used to decide whether to embed A2UI messages as structured resources
 * or fall back to a plain-text summary.
 */
export function isVsCodeClient(clientInfo?: { name?: string; version?: string }): boolean {
  if (!clientInfo?.name) return false;
  const name = clientInfo.name.toLowerCase();
  return name.includes('vscode') || name.includes('visual studio code') || name.includes('copilot');
}

// ---------------------------------------------------------------------------
// Tool manifest
// ---------------------------------------------------------------------------

export interface McpToolDescriptor {
  /** Tool name exactly as registered in the PackRegistry. */
  name: string;
  /** Human-readable description forwarded to the MCP tool manifest. */
  description: string;
  /** JSON Schema for tool parameters (derived from the Zod schema). */
  parametersSchema: Record<string, unknown>;
}

/**
 * File-system tool names that must NEVER appear in the MCP manifest.
 * Pack authors must set `mcpExposed: false` on these; this list is a
 * defence-in-depth guard.
 */
const FS_TOOL_NAMES = new Set([
  'core.write_file',
  'core.read_file',
  'core.list_files',
]);

/**
 * Build the list of tools to expose in the MCP tool manifest.
 *
 * Filtering rules (all must be satisfied to appear):
 * 1. `mcpExposed === true` — explicit opt-in only (default is false).
 * 2. `requiresSession !== true` — tools that require an authenticated user
 *    session are excluded to prevent unauthenticated access.
 * 3. Name must NOT be in `FS_TOOL_NAMES` — defence-in-depth for file-system tools.
 *
 * UserActions are NEVER included — they surface as interrupt blocks, not as
 * tools the LLM can call directly via MCP.
 */
export function buildMcpManifest(registry: PackRegistry): McpToolDescriptor[] {
  const result: McpToolDescriptor[] = [];

  // Iterate all registered tools via the registry's public API.
  // We access them by walking the tools that belong to each registered agent
  // OR by accessing the registry's internal tool map. Since registry doesn't
  // expose an enumerable tool list, we use a known-good agent path. However,
  // for manifest building we need ALL tools, not agent-scoped ones.
  // The registry exposes `components` as a getter — we mirror that for tools
  // by accessing the backing map through the documented `getToolsForAgent` +
  // agent listing. Instead, we rely on the PackRegistry exporting an `allTools`
  // getter we add in the type extension below. As that getter isn't yet merged,
  // we accept the registry and call the internal helper via a typed cast.
  //
  // Pragmatic approach: PackRegistry.allToolContributions is a new getter we
  // add here via module augmentation. For now we call a helper we export from
  // this module that accepts the raw tool list.
  const allTools = getRegistryTools(registry);

  for (const contrib of allTools) {
    // Rule 1: must explicitly opt-in
    if (contrib.mcpExposed !== true) continue;

    // Rule 2: must not require a user session
    if (contrib.requiresSession === true) continue;

    // Rule 3: defence-in-depth for file-system tools
    if (FS_TOOL_NAMES.has(contrib.name)) continue;

    // Extract description + parameters from the underlying SDK tool
    if (contrib.tool.type !== 'function') continue;
    const fn = contrib.tool as FunctionTool;

    result.push({
      name: contrib.name,
      description: fn.description ?? contrib.name,
      parametersSchema: (fn.parameters ?? { type: 'object', properties: {} }) as Record<string, unknown>,
    });
  }

  return result;
}

/**
 * Extract all ToolContributions from a PackRegistry via its internal field.
 * This uses a typed cast because the registry does not (yet) expose a public
 * `allTools` getter; adding one would require a registry change outside Step 12's scope.
 *
 * The cast is safe: we only read `toolsByName` which is always initialised.
 */
function getRegistryTools(registry: PackRegistry): ToolContribution[] {
  // Access the private toolsByName map via a typed cast.
  const r = registry as unknown as { toolsByName: Map<string, ToolContribution> };
  if (!r.toolsByName) return [];
  return [...r.toolsByName.values()];
}

// ---------------------------------------------------------------------------
// A2UI response building
// ---------------------------------------------------------------------------

export interface A2UIEmbeddedResource {
  type: 'resource';
  resource: {
    uri: string;
    mimeType: 'application/json+a2ui';
    text: string;
    /** Audience restriction — only user-facing content. */
    audience?: ['user'];
  };
}

export interface McpTextContent {
  type: 'text';
  text: string;
}

export type McpContentItem = McpTextContent | A2UIEmbeddedResource;

/**
 * Convert a collected list of A2UI messages into MCP content items.
 *
 * - VS Code clients: each message becomes an embedded resource with
 *   `mimeType: "application/json+a2ui"` and `audience: ["user"]`.
 * - All other clients: messages are serialised as a plain-text summary
 *   (one line per message type) so the LLM can still see what happened
 *   without receiving raw JSON that might pollute its context.
 */
export function buildA2UIContent(
  a2uiMessages: readonly Record<string, unknown>[],
  isVsCode: boolean,
): McpContentItem[] {
  if (a2uiMessages.length === 0) return [];

  if (isVsCode) {
    return a2uiMessages.map((msg, i): A2UIEmbeddedResource => ({
      type: 'resource',
      resource: {
        uri: `a2ui://kickstart/turn/${i}`,
        mimeType: 'application/json+a2ui',
        text: JSON.stringify(msg),
        audience: ['user'],
      },
    }));
  }

  // Non-VS Code: plain-text summary — do not inject raw JSON into model context
  const lines = a2uiMessages.map((msg) => {
    const type = typeof msg['type'] === 'string' ? msg['type'] : 'ui-update';
    return `[A2UI ${type}]`;
  });
  return [{ type: 'text', text: lines.join('\n') }];
}

// ---------------------------------------------------------------------------
// Interrupt block
// ---------------------------------------------------------------------------

/**
 * Structured interrupt block returned to the MCP client when the Runner
 * hits a UserAction.
 *
 * The MCP client handles consent out-of-band and resumes via the resume endpoint.
 * UserActions are NEVER listed in the MCP tool schema — only returned inline.
 */
export interface McpInterruptBlock {
  type: 'interrupt';
  actionId: string;
  actionName: string;
  confirmComponent?: {
    component: string;
    props?: Record<string, unknown>;
  };
  /** Serialised JSON Schema of the expected result payload. */
  resultSchema: Record<string, unknown>;
}

/**
 * Serialise an interrupt block as an MCP text content item.
 * The JSON is always structured — never human-readable text —
 * so the MCP client can parse it programmatically.
 */
export function buildInterruptContent(block: McpInterruptBlock): McpTextContent {
  return {
    type: 'text',
    text: JSON.stringify(block),
  };
}
