/**
 * @module @kickstart/core/tools/types
 *
 * Tool interface and OpenAI function-calling format types.
 */

/** A callable tool exposed to the LLM via function calling. */
export interface Tool<TArgs = Record<string, unknown>> {
  /** Unique tool name — must be a valid function identifier */
  name: string;
  /** Human-readable description for the LLM to understand when to call this */
  description: string;
  /** JSON Schema describing the tool's parameters */
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  /**
   * When true, the tool requires explicit user approval before execution.
   * Tools that modify state or access sensitive resources should set this.
   * Default: false (auto-approved for read-only tools).
   */
  requireApproval?: boolean;
  /** Execute the tool and return a result the LLM can consume */
  execute(args: TArgs): Promise<unknown>;
}

/** OpenAI function-calling tool definition format */
export interface OpenAIToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

/** A tool call requested by the LLM in a chat completion response */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    /** JSON-encoded arguments string */
    arguments: string;
  };
}

/** Result of executing a tool call */
export interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  result: unknown;
  error?: string;
}
