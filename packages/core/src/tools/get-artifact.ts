/**
 * @module @kickstart/core/tools/get-artifact
 *
 * get_artifact — retrieve the full content of a specific generated artifact by path.
 */

import type { Tool } from "../types.js";
import { defaultArtifactStore } from "../artifacts/index.js";

interface GetArtifactArgs {
  path: string;
}

export const getArtifact: Tool<GetArtifactArgs> = {
  name: "get_artifact",
  description:
    "Retrieve the full content of a generated artifact by its path (e.g. 'k8s/deployment.yaml'). Use list_artifacts first to discover available paths.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Exact artifact path as returned by list_artifacts.",
      },
    },
    required: ["path"],
  },

  async execute(args: GetArtifactArgs): Promise<unknown> {
    const artifact = defaultArtifactStore.get(args.path);
    if (!artifact) {
      return { found: false, path: args.path };
    }
    return {
      found: true,
      path: artifact.path,
      language: artifact.language,
      content: artifact.content,
      createdAt: artifact.createdAt.toISOString(),
      updatedAt: artifact.updatedAt.toISOString(),
      metadata: artifact.metadata,
    };
  },
};
