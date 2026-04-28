import { tool } from '@openai/agents';
import { mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';
import type { SessionCtx } from '@aks-kickstart/harness';

// ── Path confinement ──────────────────────────────────────────────────────────

function resolveConfinedPath(workspaceRoot: string, relativePath: string): string {
  if (relativePath.includes('\0')) {
    throw new Error('write_file: path contains null byte');
  }

  const resolved = resolve(workspaceRoot, relativePath);
  const realBase = realpathSync(workspaceRoot);

  // The file being written may not exist yet; walk up to the closest existing
  // ancestor directory to check for symlink escape.
  let checkDir = dirname(resolved);
  let realCheck: string;
  while (true) {
    try {
      realCheck = realpathSync(checkDir);
      break;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      const parent = dirname(checkDir);
      if (parent === checkDir) throw new Error(`write_file: path escapes workspace root: ${relativePath}`, { cause: err });
      checkDir = parent;
    }
  }

  if (!realCheck.startsWith(realBase + sep) && realCheck !== realBase) {
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

      const workspaceRoot = (session as unknown as { workspaceRoot?: string })?.workspaceRoot;
      if (!workspaceRoot) {
        return 'write_file: no server-side workspace available. Files are held in-browser.';
      }

      const fullPath = resolveConfinedPath(resolve(workspaceRoot), input.path);

      // Record the artifact in the session so downstream tools (validate, search) can find it.
      session?.recordArtifact({ path: input.path, kind: 'file' });

      try {
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, input.content, { encoding: 'utf-8' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`write_file: cannot write "${input.path}": ${msg}`, { cause: err });
      }

      return `Written: ${input.path} (${input.content.length} bytes)`;
    },
  }),
};
