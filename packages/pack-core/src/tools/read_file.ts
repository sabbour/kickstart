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

// ── Per-agent filename allowlist (Zapp Z4, #198) ─────────────────────────────
//
// Defence-in-depth on top of the workspace-root + traversal + symlink controls
// in resolveConfinedPath. Some agents (notably core.triage) MUST only read a
// fixed set of well-known files; widening that surface is a security
// regression. The allowlist is hard-coded per agent rather than env-driven so
// a misconfigured deployment can never silently broaden it.
//
// triage justification: per DP §5 + Zapp Z4, the triage prompt describes
// reading three files only (`.kickstart/state.json`, `plan.md`,
// `safeguards-report.md`). The prompt-side rule is a soft control; this
// allowlist is the hard control enforced at the tool layer.
//
// Other agents (codesmith, reviewer) intentionally have broader file access
// — they are NOT in this map, so the allowlist check is bypassed for them.

export const READ_FILE_AGENT_ALLOWLIST: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  [
    'core.triage',
    new Set<string>([
      '.kickstart/state.json',
      'plan.md',
      'safeguards-report.md',
    ]),
  ],
]);

function normalizeRelative(p: string): string {
  // Strip a leading `./` so callers writing either `plan.md` or `./plan.md`
  // hit the same allowlist entry. Backslashes are folded to forward slashes
  // on Windows-style inputs for the same reason.
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function assertAllowedForAgent(activeAgent: string | undefined, relativePath: string): void {
  if (!activeAgent) return;
  const allowed = READ_FILE_AGENT_ALLOWLIST.get(activeAgent);
  if (!allowed) return; // No allowlist configured → unrestricted (codesmith etc.)
  const normalized = normalizeRelative(relativePath);
  if (!allowed.has(normalized)) {
    throw new Error(
      `read_file: path "${relativePath}" is not in the per-agent allowlist for ${activeAgent}. ` +
        `Allowed: ${Array.from(allowed).join(', ')}`,
    );
  }
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

      // Z4 — per-agent filename allowlist (deny-by-default for agents in
      // READ_FILE_AGENT_ALLOWLIST). Run BEFORE workspace resolution so a
      // disallowed read is rejected even if the workspace root is misconfigured.
      assertAllowedForAgent(
        (session as unknown as { activeAgent?: string })?.activeAgent,
        input.path,
      );

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
