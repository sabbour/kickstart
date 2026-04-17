import { tool } from '@openai/agents';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import type { ToolContribution } from '@kickstart/harness';
import type { SessionCtx } from '@kickstart/harness';

// ── Path confinement ──────────────────────────────────────────────────────────

function resolveConfinedPath(workspaceRoot: string, relativePath: string): string {
  if (relativePath.includes('\0')) {
    throw new Error('write_file: path contains null byte');
  }

  const resolved = resolve(workspaceRoot, relativePath);

  if (!resolved.startsWith(workspaceRoot + '/') && resolved !== workspaceRoot) {
    throw new Error(`write_file: path escapes workspace root: ${relativePath}`);
  }

  return resolved;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const WriteFileInputSchema = z.object({
  path: z
    .string()
    .min(1)
    .describe(
      'Relative path to write within the session workspace. ' +
      'Intermediate directories are created automatically. Must not contain ".." traversal segments.',
    ),
  content: z
    .string()
    .describe('UTF-8 text content to write. Binary writes are not supported.'),
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const writeFileTool: ToolContribution = {
  name: 'core.write_file',
  tool: tool({
    name: 'core.write_file',
    description:
      'Writes UTF-8 text content to a file at the given path within the session workspace. ' +
      'Creates intermediate directories as needed. ' +
      'Path must be relative to the workspace root; traversal (../) is not allowed. Binary writes are not supported.',
    parameters: WriteFileInputSchema,
    execute: async (input, runCtx) => {
      const session = runCtx?.context as SessionCtx | undefined;

      const workspaceRoot = (session as unknown as { workspaceRoot?: string })?.workspaceRoot
        ?? process.cwd();

      const fullPath = resolveConfinedPath(resolve(workspaceRoot) + '/', input.path);

      // Record the artifact in the session so downstream tools (validate, search) can find it.
      session?.recordArtifact({ path: input.path, kind: 'file' });

      try {
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, input.content, { encoding: 'utf-8' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`write_file: cannot write "${input.path}": ${msg}`);
      }

      return `Written: ${input.path} (${input.content.length} bytes)`;
    },
  }),
};
