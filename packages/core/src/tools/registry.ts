/**
 * @module @kickstart/core/tools/registry
 *
 * ToolRegistry — central register for LLM-callable tools.
 * IntegrationKits (B-10) register their own tools here.
 */

import type { Tool, OpenAIToolDefinition } from "./types.js";
import { logger } from "../telemetry/index.js";

export class ToolRegistry {
  private readonly tools = new Map<string, Tool<any>>();

  /** Register a tool. Overwrites if name already registered. */
  register(tool: Tool<any>): void {
    this.tools.set(tool.name, tool);
  }

  /** Register multiple tools at once. */
  registerAll(tools: Tool<any>[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /** Look up a tool by name. Returns undefined if not found. */
  get(name: string): Tool<any> | undefined {
    return this.tools.get(name);
  }

  /** Return all registered tools. */
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

  /**
   * Execute a named tool, logging the call and result.
   * Throws if the tool is not registered or execution fails.
   * Tools with `requireApproval: true` are blocked from automatic execution.
   */
  async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      logger.warn(`Tool not found: ${name}`);
      throw new Error(`Tool not registered: ${name}`);
    }
    // Approval gate: block tools that require user confirmation
    if (tool.requireApproval) {
      logger.warn(`Tool "${name}" requires user approval — skipping automatic execution.`);
      return {
        error: `Tool "${name}" requires user approval before execution. This action was not performed automatically.`,
        requiresApproval: true,
      };
    }

    logger.track('tool.call', { tool: name, args });
    try {
      const result = await tool.execute(args);
      logger.track('tool.result', { tool: name, result });
      return result;
    } catch (err) {
      logger.error(`Tool execution failed: ${name}`, err);
      throw err;
    }
  }

  /** Number of registered tools. */
  get size(): number {
    return this.tools.size;
  }
}

/** Singleton default registry. Import and use directly, or create a new instance. */
export const defaultRegistry = new ToolRegistry();
