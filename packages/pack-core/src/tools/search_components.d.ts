import type { ComponentContribution, ToolContribution } from '@aks-kickstart/harness';
/** Minimal interface covering the registry subset this tool requires. */
export interface ComponentRegistry {
    readonly components: ComponentContribution[];
}
/**
 * Creates the `core.search_components` tool bound to a sealed component registry.
 * Call this during pack startup after the PackRegistry is sealed.
 */
export declare function createSearchComponentsTool(registry: ComponentRegistry): ToolContribution;
//# sourceMappingURL=search_components.d.ts.map