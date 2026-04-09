/**
 * @module @kickstart/core/tools/registry
 *
 * ToolRegistry — central register for LLM-callable tools.
 * IntegrationKits (B-10) register their own tools here.
 */

import type { Tool, OpenAIToolDefinition } from "./types.js";

export class ToolRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly tools = new Map<string, Tool<any>>();

  /** Register a tool. Overwrites if name already registered. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(tool: Tool<any>): void {
    this.tools.set(tool.name, tool);
  }

  /** Register multiple tools at once. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerAll(tools: Tool<any>[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /** Look up a tool by name. Returns undefined if not found. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(name: string): Tool<any> | undefined {
    return this.tools.get(name);
  }

  /** Return all registered tools. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAll(): Tool<any>[] {
    return Array.from(this.tools.values());
  }

  /** Export all tools in OpenAI function-calling format. */
  toOpenAIFormat(): OpenAIToolDefinition[] {
    return this.getAll().map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /** Number of registered tools. */
  get size(): number {
    return this.tools.size;
  }
}

/** Singleton default registry. Import and use directly, or create a new instance. */
export const defaultRegistry = new ToolRegistry();
