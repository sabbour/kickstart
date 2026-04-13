/**
 * fs_read — Read file contents from the active filesystem provider.
 */

import type { Tool, ToolContext } from "../tools/types.js";

interface FsReadArgs {
  path: string;
}

export const fsRead: Tool<FsReadArgs> = {
  name: "fs_read",
  description:
    "Read the contents of a file from the remote filesystem. " +
    "Use this to inspect existing project files, configuration, " +
    "or deployment artifacts on the user's machine.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Relative file path to read (forward slashes, e.g. 'src/index.ts').",
      },
    },
    required: ["path"],
  },

  async execute(args: FsReadArgs, context: ToolContext): Promise<unknown> {
    if (!context.fileSystem) {
      return {
        error:
          "No filesystem provider is available. " +
          "File operations require a connected environment (e.g. Cloud Shell).",
      };
    }

    try {
      const content = await context.fileSystem.read(args.path);
      return {
        path: args.path,
        content,
        size: new TextEncoder().encode(content).byteLength,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
        path: args.path,
      };
    }
  },
};
