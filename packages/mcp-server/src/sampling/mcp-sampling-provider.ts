/**
 * @module @aks-kickstart/mcp-server/sampling/mcp-sampling-provider
 *
 * MCP host-managed sampling — Option B.
 *
 * Implements the `@openai/agents` `ModelProvider` / `Model` interfaces so
 * the harness Runner can delegate inference to the MCP host (VS Code /
 * GitHub Copilot) via `sampling/createMessage` instead of calling an
 * Azure OpenAI endpoint directly.  Zero BYOK for MCP users.
 *
 * Architecture
 * ────────────
 * - `McpSamplingProvider` implements `ModelProvider`; returns one shared
 *   `McpSamplingModel` for every `getModel()` call.
 * - `McpSamplingModel` implements `Model`:
 *     • `getResponse(request)` — translates the SDK `ModelRequest` to MCP
 *       `sampling/createMessage`, validates any `tool_use` blocks returned
 *       by the host (Zapp H1), and translates the result back to a
 *       `ModelResponse` that the SDK runner can process.
 *     • `getStreamedResponse(request)` — MCP sampling has no streaming
 *       surface, so this wraps `getResponse()` and emits a single
 *       `response_done` event.
 *
 * Tool allowlist validation (Zapp H1)
 * ─────────────────────────────────────
 * Before forwarding a `tool_use` block from the host back to the SDK runner
 * for execution, the provider validates:
 *   1. The tool name is in the offered-tools allowlist (names passed at
 *      construction time from the harness manifest).
 *   2. The tool arguments pass the tool's JSON Schema (basic structural
 *      check via `validateAgainstSchema`).
 * Fail-closed: a validation failure throws so the SDK runner surfaces an
 * error rather than executing an untrusted tool call.
 *
 * Invariant
 * ─────────
 * This file MUST NOT import from `runner.ts` or `model-helpers.ts` to avoid
 * circular dependencies.  It depends only on `@openai/agents-core` types
 * (via `@openai/agents`) and the MCP SDK's `Server` class.
 */

import { randomUUID } from 'node:crypto';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type {
  Model,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  AgentInputItem,
} from '@openai/agents';
import type { StreamEvent } from '@openai/agents';
import { Usage } from '@openai/agents';

// ---------------------------------------------------------------------------
// Internal helpers — JSON Schema argument validation (Zapp H1)
// ---------------------------------------------------------------------------

/**
 * Minimal structural validation of `args` against a JSON Schema object.
 *
 * We check only `required` properties and `type` of each property — a
 * full AJV-style deep validator would be preferable in production but adds
 * a dependency; this is fail-closed (returns false on any schema mismatch).
 *
 * Returns `true` when args satisfy the schema, `false` otherwise.
 */
function validateAgainstSchema(
  args: Record<string, unknown>,
  schema: Record<string, unknown> | undefined,
): boolean {
  if (!schema || typeof schema !== 'object') return true; // no schema → pass
  const properties = schema['properties'] as Record<string, { type?: string }> | undefined;
  const required = (schema['required'] as string[] | undefined) ?? [];

  // Check all required fields are present
  for (const key of required) {
    if (!(key in args)) return false;
  }

  // Check types of declared properties
  if (properties) {
    for (const [key, propSchema] of Object.entries(properties)) {
      if (!(key in args)) continue; // optional missing field is fine
      if (propSchema.type && typeof args[key] !== propSchema.type) {
        // Allow numeric fields — but integer requires a whole number
        if (propSchema.type === 'number' && typeof args[key] === 'number') {
          continue;
        }
        if (propSchema.type === 'integer' && Number.isInteger(args[key])) {
          continue;
        }
        return false;
      }
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Type-translation helpers
// ---------------------------------------------------------------------------

/**
 * Translate an SDK `AgentInputItem[]` (OpenAI Responses-API format) to the
 * flat `SamplingMessage[]` list that MCP `sampling/createMessage` expects.
 *
 * Mapping rules:
 * - `UserMessageItem`  → `{role:"user", content:[{type:"text",text:…}]}`
 * - `AssistantMessageItem` → `{role:"assistant", content:[{type:"text",text:…}]}`
 * - `FunctionCallItem` (type:"function_call") → appended as `tool_use` block
 *   to the last assistant turn.  If no assistant turn precedes, a synthetic
 *   one is created.
 * - `FunctionCallResultItem` (type:"function_call_result") → appended as
 *   `tool_result` block to a new user turn.
 * - All other item types are silently skipped (system messages, reasoning
 *   items, etc. are not representable in the MCP sampling format).
 */
function toSamplingMessages(
  input: AgentInputItem[],
): Array<{ role: 'user' | 'assistant'; content: unknown[] }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: unknown[] }> = [];

  for (const item of input) {
    const t = (item as { type?: string }).type;

    if (t === 'message') {
      const role = (item as { role?: string }).role;
      const rawContent = (item as { content?: unknown }).content;

      if (role === 'user') {
        const text =
          typeof rawContent === 'string'
            ? rawContent
            : Array.isArray(rawContent)
              ? (rawContent as Array<{ type?: string; text?: string }>)
                  .filter((c) => c.type === 'input_text' && typeof c.text === 'string')
                  .map((c) => c.text as string)
                  .join('\n') || '[user message]'
              : '[user message]';
        messages.push({ role: 'user', content: [{ type: 'text', text }] });
      } else if (role === 'assistant') {
        const text = Array.isArray(rawContent)
          ? (rawContent as Array<{ type?: string; text?: string }>)
              .filter((c) => c.type === 'output_text' && typeof c.text === 'string')
              .map((c) => c.text as string)
              .join('\n')
          : typeof rawContent === 'string'
            ? rawContent
            : '';
        if (text) {
          messages.push({ role: 'assistant', content: [{ type: 'text', text }] });
        } else {
          // Keep as placeholder so subsequent tool_use blocks have a parent
          messages.push({ role: 'assistant', content: [] });
        }
      }
      continue;
    }

    if (t === 'function_call') {
      const call = item as { name?: string; callId?: string; arguments?: string };
      let argsParsed: Record<string, unknown> = {};
      try {
        argsParsed = JSON.parse(call.arguments ?? '{}') as Record<string, unknown>;
      } catch {
        // Malformed JSON — pass empty args
      }
      const toolUseBlock = {
        type: 'tool_use' as const,
        id: call.callId ?? randomUUID(),
        name: call.name ?? 'unknown',
        input: argsParsed,
      };
      // Append to last assistant message; create one if needed
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        last.content.push(toolUseBlock);
      } else {
        messages.push({ role: 'assistant', content: [toolUseBlock] });
      }
      continue;
    }

    if (t === 'function_call_result') {
      const result = item as { callId?: string; output?: unknown };
      const outputText =
        typeof result.output === 'string'
          ? result.output
          : Array.isArray(result.output)
            ? (result.output as Array<{ text?: string }>)
                .map((c) => (typeof c.text === 'string' ? c.text : ''))
                .join('\n')
            : JSON.stringify(result.output ?? '');
      const toolResultBlock = {
        type: 'tool_result' as const,
        toolUseId: result.callId ?? randomUUID(),
        content: [{ type: 'text' as const, text: outputText }],
      };
      // Append to last user message; create one if needed
      const last = messages[messages.length - 1];
      if (last?.role === 'user') {
        last.content.push(toolResultBlock);
      } else {
        messages.push({ role: 'user', content: [toolResultBlock] });
      }
      continue;
    }

    // All other item types (system, reasoning, compaction…) are skipped.
  }

  return messages;
}

/**
 * Translate an SDK `SerializedTool[]` to the MCP tool definition list
 * accepted by `CreateMessageRequestParamsWithTools`.
 *
 * Only `function` type tools are included; hosted/shell/computer tools are
 * omitted because MCP sampling does not support them.
 */
function toMcpTools(
  tools: Array<{
    type?: string;
    name?: string;
    description?: string;
    parameters?: unknown;
  }>,
): Array<{ name: string; description: string; inputSchema: unknown }> {
  return tools
    .filter((t) => t.type === 'function' && typeof t.name === 'string')
    .map((t) => ({
      name: t.name as string,
      description: t.description ?? t.name ?? '',
      inputSchema: t.parameters ?? { type: 'object', properties: {} },
    }));
}

// ---------------------------------------------------------------------------
// McpSamplingModel — implements Model via sampling/createMessage
// ---------------------------------------------------------------------------

class McpSamplingModel implements Model {
  constructor(
    private readonly server: Server,
    /** Allowed tool names (from the harness manifest). Empty ⟹ no tools. */
    private readonly toolAllowlist: Set<string>,
    /** Schema by tool name for argument validation. */
    private readonly toolSchemas: Map<string, Record<string, unknown>>,
  ) {}

  async getResponse(request: ModelRequest): Promise<ModelResponse> {
    const inputItems = Array.isArray(request.input)
      ? (request.input as AgentInputItem[])
      : ([{ type: 'message', role: 'user', content: request.input as string }] as unknown as AgentInputItem[]);

    const messages = toSamplingMessages(inputItems);

    // Keep systemInstructions separate; they become the MCP systemPrompt.
    const mcpTools = toMcpTools(
      request.tools as Array<{
        type?: string;
        name?: string;
        description?: string;
        parameters?: unknown;
      }>,
    );

    // Build request params — use the WithTools overload when tools are available.
    // Cast tools to `any` to satisfy the strict MCP SDK type (inputSchema must be
    // `{type:"object", ...}`) while still passing the harness JSON Schema shapes.
    type CreateMessageParams = Parameters<Server['createMessage']>[0];
    const params: CreateMessageParams = {
      messages: messages as Parameters<Server['createMessage']>[0]['messages'],
      ...(request.systemInstructions ? { systemPrompt: request.systemInstructions } : {}),
      maxTokens: 4096,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(mcpTools.length > 0 ? { tools: mcpTools as any } : {}),
    };

    let rawResult: Awaited<ReturnType<Server['createMessage']>>;
    try {
      rawResult = await this.server.createMessage(params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Fail-closed: surface as an error response the SDK can handle.
      throw new Error(`[mcp-sampling] sampling/createMessage failed: ${msg}`);
    }

    // ── Translate result → AgentOutputItem[] ──────────────────────────────

    // Use unknown[] + casts to avoid AgentOutputItem import cycle issues.
    const output: unknown[] = [];

    // content may be a single block or an array (WithTools path)
    const contentBlocks = Array.isArray(rawResult.content)
      ? rawResult.content
      : [rawResult.content];

    let hasTextOutput = false;
    let textBuffer = '';

    for (const block of contentBlocks) {
      if (!block || typeof block !== 'object') continue;
      const b = block as { type?: string };

      if (b.type === 'text') {
        const textBlock = b as { type: 'text'; text: string };
        textBuffer += textBlock.text;
        hasTextOutput = true;
        continue;
      }

      if (b.type === 'tool_use') {
        const toolUse = b as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

        // ── Zapp H1: tool allowlist + schema validation ──────────────────
        const toolName = toolUse.name;
        if (!this.toolAllowlist.has(toolName)) {
          // Tool not in allowlist — fail-closed
          process.stderr.write(
            `[mcp-sampling] Zapp H1: tool '${toolName}' not in offered-tools allowlist — rejecting\n`,
          );
          throw new Error(
            `[mcp-sampling] Tool '${toolName}' is not in the offered-tools allowlist`,
          );
        }

        const schema = this.toolSchemas.get(toolName);
        if (!validateAgainstSchema(toolUse.input, schema)) {
          process.stderr.write(
            `[mcp-sampling] Zapp H1: arguments for tool '${toolName}' failed schema validation — rejecting\n`,
          );
          throw new Error(
            `[mcp-sampling] Arguments for tool '${toolName}' failed schema validation`,
          );
        }
        // ── End Zapp H1 ──────────────────────────────────────────────────

        // Translate tool_use → FunctionCallItem
        output.push({
          type: 'function_call',
          callId: toolUse.id,
          name: toolUse.name,
          arguments: JSON.stringify(toolUse.input),
          status: 'completed',
        });
        continue;
      }

      // Unrecognised block type — skip
    }

    if (hasTextOutput) {
      output.push({
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: textBuffer }],
      });
    }

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      output: output as any,
      usage: new Usage({ input_tokens: 0, output_tokens: 0, total_tokens: 0 }),
    };
  }

  async *getStreamedResponse(request: ModelRequest): AsyncIterable<StreamEvent> {
    // MCP sampling has no streaming surface; wrap getResponse() and emit
    // a single response_done event so the SDK runner can process it.
    const response = await this.getResponse(request);
    // The SDK parses this event with StreamEventResponseCompleted.parse(),
    // which expects camelCase UsageData fields and then wraps with new Usage().
    // Pass a plain object here to avoid double-wrapping.
    const usage = response.usage;
    yield {
      type: 'response_done',
      response: {
        id: randomUUID(),
        object: 'response',
        output: response.output,
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
        },
      },
    } as unknown as StreamEvent;
  }
}

// ---------------------------------------------------------------------------
// McpSamplingProvider — public API
// ---------------------------------------------------------------------------

/**
 * Options for `McpSamplingProvider`.
 */
export interface McpSamplingProviderOptions {
  /**
   * Allowed tool names.  Only tool names present in this set will be
   * forwarded to `sampling/createMessage`.  Any `tool_use` block returned
   * by the host for a name outside this set causes a fail-closed error
   * (Zapp H1).
   *
   * Derive this from `buildMcpManifest(registry).map(d => d.name)`.
   */
  allowedToolNames: string[];

  /**
   * JSON Schema for each allowed tool, keyed by tool name.  Used by the
   * argument validator (Zapp H1).
   *
   * Derive from `buildMcpManifest(registry)` → `descriptor.parametersSchema`.
   */
  toolSchemas: Record<string, Record<string, unknown>>;
}

/**
 * `ModelProvider` that routes every `getModel()` call to `McpSamplingModel`.
 *
 * Pass to `RunConfig.samplingProvider` when the MCP client has declared
 * the `sampling` capability in the `initialize` handshake.
 */
export class McpSamplingProvider implements ModelProvider {
  private readonly model: McpSamplingModel;

  constructor(server: Server, options: McpSamplingProviderOptions) {
    const allowlist = new Set(options.allowedToolNames);
    const schemas = new Map<string, Record<string, unknown>>(
      Object.entries(options.toolSchemas),
    );
    this.model = new McpSamplingModel(server, allowlist, schemas);
  }

  getModel(_modelName?: string): McpSamplingModel {
    // Model name is intentionally ignored — the host chooses the model.
    return this.model;
  }
}
