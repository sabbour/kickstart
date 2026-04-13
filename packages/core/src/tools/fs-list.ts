/**
 * fs_list — List directory contents from the active filesystem provider.
 */

import type { Tool, ToolContext } from "../tools/types.js";

interface FsListArgs {
  directory: string;
}

export const fsList: Tool<FsListArgs> = {
  name: "fs_list",
  description:
    "List the files and directories at a given path on the remote filesystem. " +
    "Returns immediate children — not recursive. " +
    "Use this to explore the user's project structure.",
  parameters: {
    type: "object",
    properties: {
      directory: {
        type: "string",
        description:
          'Relative directory path to list (forward slashes). Use "." or "" for root.',
      },
    },
    required: ["directory"],
  },

  async execute(args: FsListArgs, context: ToolContext): Promise<unknown> {
    if (!context.fileSystem) {
      return {
        error:
          "No filesystem provider is available. " +
          "File operations require a connected environment (e.g. Cloud Shell).",
      };
    }

    try {
      const entries = await context.fileSystem.list(args.directory);
      return {
        directory: args.directory,
        count: entries.length,
        entries,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
        directory: args.directory,
      };
    }
  },
};
