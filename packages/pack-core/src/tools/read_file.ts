import { tool } from '@openai/agents';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';
import type { SessionCtx } from '@aks-kickstart/harness';

// ── Path confinement ──────────────────────────────────────────────────────────

function resolveConfinedPath(workspaceRoot: string, relativePath: string): string {
  if (relativePath.includes('\0')) {
    throw new Error('read_file: path contains null byte');
  }

  const resolved = resolve(workspaceRoot, relativePath);

  // Resolve symlinks before checking confinement to prevent symlink escape.
  const real = realpathSync(resolved);
  const realBase = realpathSync(workspaceRoot);

  if (!real.startsWith(realBase + sep) && real !== realBase) {
    throw new Error(`read_file: path escapes workspace root: ${relativePath}`);
  }

  return real;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const ReadFileInputSchema = z.object({
  path: z
    .string()
    .min(1)
    .describe(
      'Relative path to the file within the session workspace. Must not contain ".." traversal segments.',
    ),
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const readFileTool: ToolContribution = {
  name: 'core.read_file',
  tool: tool({
    name: 'core.read_file',
    description:
      'Reads a text file from the session workspace and returns its content as a string. ' +
      'The path must be relative to the workspace root. Path traversal (../) is not allowed.',
    parameters: ReadFileInputSchema,
    execute: async (input, runCtx) => {
      const session = runCtx?.context as SessionCtx | undefined;

      // Use a session-scoped workspace root when available; absent in production
      // (Azure Functions host) — return a clear error rather than crashing.
      const workspaceRoot = (session as unknown as { workspaceRoot?: string })?.workspaceRoot;
      if (!workspaceRoot) {
        return `read_file: no server-side workspace available. Use the in-browser artifact store to access "${input.path}".`;
      }

      const fullPath = resolveConfinedPath(resolve(workspaceRoot), input.path);

      let content: string;
      try {
        content = readFileSync(fullPath, { encoding: 'utf-8' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`read_file: cannot read "${input.path}": ${msg}`, { cause: err });
      }

      return content;
    },
  }),
};
