/**
 * core.fix_safeguards — deterministic rewriter for auto-fixable violations.
 *
 * Accepts a manifest and a list of violation IDs to fix. Only allowlisted
 * rule IDs are processed (Zapp condition #3). Returns the fixed manifest
 * along with audit-friendly applied/skipped/remaining lists.
 *
 * Security: no eval, no shell. Pure YAML parse → object mutation → serialize.
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';
import { applyFixes } from '../safeguards/fixes.js';
import { MAX_INPUT_BYTES } from '../safeguards/parser.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum violation IDs per invocation. */
const MAX_VIOLATION_IDS = 50;

// ── Schema ────────────────────────────────────────────────────────────────────

const FixSafeguardsInputSchema = z.object({
  manifest: z
    .string()
    .min(1, 'Manifest cannot be empty')
    .max(MAX_INPUT_BYTES, `Manifest exceeds ${MAX_INPUT_BYTES} byte limit`)
    .describe('Raw YAML manifest text to apply fixes to.'),
  ids: z
    .array(z.string().min(1))
    .min(1, 'At least one violation ID is required')
    .max(MAX_VIOLATION_IDS, `Cannot fix more than ${MAX_VIOLATION_IDS} violations per invocation`)
    .describe(
      'Array of violation rule IDs to fix (e.g. ["privileged-container", "hostpath-volume"]). ' +
      'Non-fixable or unknown IDs are returned in skippedIds.',
    ),
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const fixSafeguardsTool: ToolContribution = {
  name: 'core.fix_safeguards',
  tool: tool({
    name: 'core.fix_safeguards',
    description:
      'Applies deterministic fixes to Kubernetes manifest YAML for the specified violation ' +
      'rule IDs. Only auto-fixable rules are applied; non-fixable IDs are returned in ' +
      'skippedIds for manual review. Returns the fixed manifest text, applied fixes, and ' +
      'remaining violations. Re-run core.check_safeguards on the fixed manifest to verify.',
    parameters: FixSafeguardsInputSchema,
    execute: async (input): Promise<string> => {
      const result = applyFixes(input.manifest, input.ids);

      return JSON.stringify({
        fixedManifest: result.fixedManifest,
        appliedFixes: result.appliedFixes,
        skippedIds: result.skippedIds,
        remainingViolations: result.remainingViolations,
      });
    },
  }),
};
