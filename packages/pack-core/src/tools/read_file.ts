import { tool } from '@openai/agents';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { ToolContribution } from '@kickstart/harness';
import type { SessionCtx } from '@kickstart/harness';

// ── Path confinement ──────────────────────────────────────────────────────────

function resolveConfinedPath(workspaceRoot: string, relativePath: string): string {
  if (relativePath.includes('\0')) {
    throw new Error('read_file: path contains null byte');
  }

  const resolved = resolve(workspaceRoot, relativePath);

  // Ensure the resolved path is inside the workspace root (no traversal).
  if (!resolved.startsWith(workspaceRoot + '/') && resolved !== workspaceRoot) {
    throw new Error(`read_file: path escapes workspace root: ${relativePath}`);
  }

  return resolved;
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

      // Use a session-scoped workspace root when available; fall back to process cwd for tests.
      const workspaceRoot = (session as unknown as { workspaceRoot?: string })?.workspaceRoot
        ?? process.cwd();

      const fullPath = resolveConfinedPath(resolve(workspaceRoot), input.path);

      let content: string;
      try {
        content = readFileSync(fullPath, { encoding: 'utf-8' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`read_file: cannot read "${input.path}": ${msg}`);
      }

      return content;
    },
  }),
};
