import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ComponentContribution, ToolContribution } from '@kickstart/harness';

// ── Schema ────────────────────────────────────────────────────────────────────

const SearchComponentsInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'Name fragment or keyword to search for in the registered component catalog. ' +
      'Matching is case-insensitive and checks the component name. ' +
      'Use "*" to list all registered components.',
    ),
});

interface ComponentSummary {
  name: string;
}

/** Minimal interface covering the registry subset this tool requires. */
export interface ComponentRegistry {
  readonly components: ComponentContribution[];
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates the `core.search_components` tool bound to a sealed component registry.
 * Call this during pack startup after the PackRegistry is sealed.
 */
export function createSearchComponentsTool(registry: ComponentRegistry): ToolContribution {
  return {
    name: 'core.search_components',
    tool: tool({
      name: 'core.search_components',
      description:
        'Searches the sealed component catalog for components matching the given name or keyword. ' +
        'Returns a JSON array of matching component entries. ' +
        'Use this to discover which UI components are available before calling core.emit_ui.',
      parameters: SearchComponentsInputSchema,
      execute: async (input, _runCtx): Promise<string> => {
        const allComponents: ComponentContribution[] = registry.components;

        const needle = input.query.toLowerCase();
        const matches =
          needle === '*'
            ? allComponents
            : allComponents.filter((c) =>
                c.name.toLowerCase().includes(needle),
              );

        const summaries: ComponentSummary[] = matches.map((c) => ({
          name: c.name,
        }));

        if (summaries.length === 0) {
          return JSON.stringify({ matches: [], message: `No components found matching "${input.query}".` });
        }

        return JSON.stringify({ matches: summaries, total: summaries.length });
      },
    }),
  };
}
