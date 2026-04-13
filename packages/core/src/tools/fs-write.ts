/**
 * fs_write — Write (create or overwrite) a file on the active filesystem.
 * Requires user approval because it modifies the user's filesystem.
 */

import type { Tool, ToolContext } from "../tools/types.js";

interface FsWriteArgs {
  path: string;
  content: string;
}

export const fsWrite: Tool<FsWriteArgs> = {
  name: "fs_write",
  description:
    "Write content to a file on the remote filesystem.  Creates the file " +
    "if it does not exist, or overwrites it if it does.  Use this to deploy " +
    "generated artifacts (Dockerfiles, K8s manifests, CI workflows) to the " +
    "user's environment.",
  requireApproval: true,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Relative file path to write (forward slashes, e.g. 'k8s/deployment.yaml').",
      },
      content: {
        type: "string",
        description: "Full file content to write.",
      },
    },
    required: ["path", "content"],
  },

  async execute(args: FsWriteArgs, context: ToolContext): Promise<unknown> {
    if (!context.fileSystem) {
      return {
        error:
          "No filesystem provider is available. " +
          "File operations require a connected environment (e.g. Cloud Shell).",
      };
    }

    try {
      await context.fileSystem.write(args.path, args.content);
      return {
        path: args.path,
        size: new TextEncoder().encode(args.content).byteLength,
        message: `File written: ${args.path}`,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
        path: args.path,
      };
    }
  },
};
