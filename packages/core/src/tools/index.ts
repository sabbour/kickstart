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
export { githubRepoTree } from "./github-repo-tree.js";
export { githubRepoFileRead } from "./github-repo-file-read.js";
export { githubApiGet } from "./github-api-get.js";
export { fetchWebpage } from "./fetch-webpage.js";
export { generateKubernetesManifest } from "./generate-kubernetes-manifest.js";
export { estimateCost } from "./estimate-cost.js";
export { listArtifacts } from "./list-artifacts.js";
export { getArtifact } from "./get-artifact.js";

// Input validation
export { validatePath, validateRef } from "./github-input-validation.js";
export type { ValidationResult } from "./github-input-validation.js";

// Bootstrap the default registry with all built-in tools
import { defaultRegistry } from "./registry.js";
import { azureResourceList } from "./azure-resource-list.js";
import { azureResourceGet } from "./azure-resource-get.js";
import { githubRepoInfo } from "./github-repo-info.js";
import { githubRepoTree } from "./github-repo-tree.js";
import { githubRepoFileRead } from "./github-repo-file-read.js";
import { githubApiGet } from "./github-api-get.js";
import { fetchWebpage } from "./fetch-webpage.js";
import { generateKubernetesManifest } from "./generate-kubernetes-manifest.js";
import { estimateCost } from "./estimate-cost.js";
import { listArtifacts } from "./list-artifacts.js";
import { getArtifact } from "./get-artifact.js";

defaultRegistry.registerAll([
  azureResourceList,
  azureResourceGet,
  githubRepoInfo,
  githubRepoTree,
  githubRepoFileRead,
  githubApiGet,
  fetchWebpage,
  generateKubernetesManifest,
  estimateCost,
  listArtifacts,
  getArtifact,
]);
