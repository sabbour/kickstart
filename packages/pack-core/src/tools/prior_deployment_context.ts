/**
 * core.priorDeploymentContext — Phase 3 state reader (#218)
 * ===========================================================
 *
 * Reads `.kickstart/state.json` from the session workspace and extracts
 * prior deployment context for the triage agent's iteration path.
 *
 * When a prior deployment exists, triage skips redundant onboarding questions
 * and goes straight to iteration mode, populating the `iteration.priorDeploymentContext`
 * slot in the typed handoff briefing.
 *
 * Security controls:
 *  1. Path is hard-coded to `.kickstart/state.json` — no caller-supplied path.
 *  2. Workspace root is required; absent root returns null context (graceful
 *     degradation to core.read_file + core.inspect_repo fallback per Nibbler R6).
 *  3. Unknown/extra fields in state.json are silently ignored (no schema blast).
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ToolContribution } from '@aks-kickstart/harness';
import type { SessionCtx } from '@aks-kickstart/harness';
import { PriorDeploymentContextSchema, type PriorDeploymentContext } from '../triage/handoff-schema.js';

// ── Internal state.json schema (lenient — extra fields are stripped) ─────────

const KickstartStateSchema = z.object({
  lastRecipe: z.string().min(1).max(256).optional(),
  lastHandoffTarget: z.string().min(1).max(128).optional(),
  summary: z.string().min(1).max(1024).optional(),
});

const STATE_FILE = '.kickstart/state.json';

// ── Extraction helper (exported for unit tests) ───────────────────────────────

/**
 * Extracts prior deployment context from a parsed `.kickstart/state.json`
 * object. Returns `null` when the state lacks enough data to form a valid
 * context (e.g. first-time run — no prior deployment yet).
 */
export function extractPriorDeploymentContext(
  raw: unknown,
  workspaceStateFile: string,
): PriorDeploymentContext | null {
  const parsed = KickstartStateSchema.safeParse(raw);
  if (!parsed.success) return null;

  const { lastRecipe, lastHandoffTarget, summary } = parsed.data;
  if (!lastRecipe || !lastHandoffTarget || !summary) return null;

  const ctx = {
    lastRecipe,
    lastHandoffTarget,
    workspaceStateFile,
    summary,
  };

  // Validate against the canonical schema before returning.
  const validated = PriorDeploymentContextSchema.safeParse(ctx);
  return validated.success ? validated.data : null;
}

// ── Output schema ─────────────────────────────────────────────────────────────

const PriorDeploymentContextOutputSchema = z.object({
  found: z.boolean(),
  context: PriorDeploymentContextSchema.optional(),
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const priorDeploymentContextTool: ToolContribution = {
  name: 'core.priorDeploymentContext',
  tool: tool({
    name: 'core.priorDeploymentContext',
    description:
      'Reads .kickstart/state.json from the session workspace and returns structured prior ' +
      'deployment context. When found: { found: true, context: { lastRecipe, lastHandoffTarget, ' +
      'workspaceStateFile, summary } }. When absent or first-time run: { found: false }. ' +
      'Use this at the start of every triage turn to check for an existing deployment before ' +
      'asking onboarding questions.',
    parameters: z.object({}),
    execute: async (_input, runCtx) => {
      const session = runCtx?.context as (SessionCtx & { workspaceRoot?: string }) | undefined;
      const workspaceRoot = session?.workspaceRoot;

      if (!workspaceRoot) {
        return JSON.stringify({ found: false } satisfies z.infer<typeof PriorDeploymentContextOutputSchema>);
      }

      const stateFilePath = resolve(workspaceRoot, STATE_FILE);

      let raw: unknown;
      try {
        const text = readFileSync(stateFilePath, { encoding: 'utf-8' });
        raw = JSON.parse(text);
      } catch {
        return JSON.stringify({ found: false } satisfies z.infer<typeof PriorDeploymentContextOutputSchema>);
      }

      const context = extractPriorDeploymentContext(raw, STATE_FILE);
      if (!context) {
        return JSON.stringify({ found: false } satisfies z.infer<typeof PriorDeploymentContextOutputSchema>);
      }

      return JSON.stringify({ found: true, context } satisfies z.infer<typeof PriorDeploymentContextOutputSchema>);
    },
  }),
};
