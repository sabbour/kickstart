/**
 * core.check_safeguards — static analysis tool for Kubernetes manifests.
 *
 * Scans Helm/Kustomize manifests against AKS-Automatic-compatibility rules
 * ported from Microsoft AKS-Copilot PRs #1837 and #1976.
 *
 * Security: no eval, no shell, no helm template, no kustomize build.
 * Pure YAML parsing with safe loader + input bounds enforcement.
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';
import { checkSafeguards } from '../safeguards/check.js';
import { MAX_INPUT_BYTES } from '../safeguards/parser.js';

// ── Schema ────────────────────────────────────────────────────────────────────

const CheckSafeguardsInputSchema = z.object({
  manifest: z
    .string()
    .min(1, 'Manifest cannot be empty')
    .max(MAX_INPUT_BYTES, `Manifest exceeds ${MAX_INPUT_BYTES} byte limit`)
    .describe(
      'Raw YAML manifest text (single or multi-document). Supports Deployment, ' +
      'StatefulSet, DaemonSet, Pod, Job, CronJob, and ReplicaSet kinds.',
    ),
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const checkSafeguardsTool: ToolContribution = {
  name: 'core.check_safeguards',
  tool: tool({
    name: 'core.check_safeguards',
    description:
      'Scans Kubernetes manifest YAML against AKS-Automatic safeguard rules ported from ' +
      'Microsoft AKS-Copilot PRs #1837 and #1976. Returns structured violations with ' +
      'severity (high/medium/low), rule ID, MS PR attribution link, and whether an ' +
      'automatic fix is available. Use core.fix_safeguards to auto-remediate fixable violations.',
    parameters: CheckSafeguardsInputSchema,
    execute: async (input): Promise<string> => {
      const result = checkSafeguards(input.manifest);

      return JSON.stringify({
        ok: result.ok,
        violations: result.violations.map((v) => ({
          id: v.id,
          title: v.title,
          severity: v.severity,
          message: v.message,
          msprLink: v.msprLink,
          autoFixable: v.autoFixable,
          path: v.path,
        })),
        summary: result.summary,
        ...(result.parseError ? { parseError: result.parseError } : {}),
      });
    },
  }),
};
