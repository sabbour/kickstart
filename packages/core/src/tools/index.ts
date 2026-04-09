/**
 * @module @kickstart/core/tools
 *
 * LLM tool system — registry, tool definitions, and OpenAI function-calling exports.
 * IntegrationKits (B-10) register their own tools via `defaultRegistry.register()`.
 */

export type { Tool, OpenAIToolDefinition, ToolCall, ToolCallResult } from "./types.js";
export { ToolRegistry, defaultRegistry } from "./registry.js";

// Built-in tool definitions
export { azureResourceList } from "./azure-resource-list.js";
export { azureResourceGet } from "./azure-resource-get.js";
export { githubRepoInfo } from "./github-repo-info.js";
export { generateKubernetesManifest } from "./generate-kubernetes-manifest.js";
export { estimateCost } from "./estimate-cost.js";

// Bootstrap the default registry with all built-in tools
import { defaultRegistry } from "./registry.js";
import { azureResourceList } from "./azure-resource-list.js";
import { azureResourceGet } from "./azure-resource-get.js";
import { githubRepoInfo } from "./github-repo-info.js";
import { generateKubernetesManifest } from "./generate-kubernetes-manifest.js";
import { estimateCost } from "./estimate-cost.js";

defaultRegistry.registerAll([
  azureResourceList,
  azureResourceGet,
  githubRepoInfo,
  generateKubernetesManifest,
  estimateCost,
]);
