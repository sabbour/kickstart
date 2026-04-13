/**
 * fs_delete — Delete a file from the active filesystem provider.
 * Requires user approval because it is destructive.
 */

import type { Tool, ToolContext } from "../tools/types.js";

interface FsDeleteArgs {
  path: string;
}

export const fsDelete: Tool<FsDeleteArgs> = {
  name: "fs_delete",
  description:
    "Delete a file from the remote filesystem.  " +
    "Use with caution — this permanently removes the file from the user's environment.",
  requireApproval: true,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Relative file path to delete (forward slashes, e.g. 'old-config.yaml').",
      },
    },
    required: ["path"],
  },

  async execute(args: FsDeleteArgs, context: ToolContext): Promise<unknown> {
    if (!context.fileSystem) {
      return {
        error:
          "No filesystem provider is available. " +
          "File operations require a connected environment (e.g. Cloud Shell).",
      };
    }

    try {
      const existed = await context.fileSystem.exists(args.path);
      await context.fileSystem.delete(args.path);
      return {
        path: args.path,
        deleted: existed,
        message: existed
          ? `File deleted: ${args.path}`
          : `File not found (no-op): ${args.path}`,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
        path: args.path,
      };
    }
  },
};
