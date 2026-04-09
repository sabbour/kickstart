/**
 * @module @kickstart/core/tools/list-artifacts
 *
 * list_artifacts — return all artifacts currently stored, optionally filtered
 * by a glob pattern. Used by the LLM and UI to enumerate generated files.
 */

import type { Tool } from "../types.js";
import { defaultArtifactStore } from "../artifacts/index.js";

interface ListArtifactsArgs {
  glob?: string;
}

export const listArtifacts: Tool<ListArtifactsArgs> = {
  name: "list_artifacts",
  description:
    "List all generated artifacts (K8s manifests, Dockerfiles, CI workflows, etc.) that have been created in this session. Optionally filter by a glob pattern such as 'k8s/**' or '**/*.yaml'.",
  parameters: {
    type: "object",
    properties: {
      glob: {
        type: "string",
        description:
          "Optional glob pattern to filter results. Supports * (within a path segment) and ** (across segments). Example: 'k8s/**' or '**/*.yaml'",
      },
    },
    required: [],
  },

  async execute(args: ListArtifactsArgs): Promise<unknown> {
    const artifacts = defaultArtifactStore.list(args.glob);
    return {
      count: artifacts.length,
      artifacts: artifacts.map((a) => ({
        path: a.path,
        language: a.language,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        metadata: a.metadata,
      })),
    };
  },
};
