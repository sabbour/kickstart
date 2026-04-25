/**
 * High-level check function that combines parsing + rule evaluation.
 */

import { parseManifest } from './parser.js';
import { SAFEGUARD_RULES, type SafeguardViolation } from './rules.js';

export interface CheckResult {
  ok: boolean;
  violations: SafeguardViolation[];
  summary: { high: number; medium: number; low: number };
  parseError?: string;
}

/**
 * Check a manifest YAML string against all safeguard rules.
 * Returns structured violations. Never throws.
 */
export function checkSafeguards(manifest: string): CheckResult {
  const parsed = parseManifest(manifest);
  if (!parsed.ok) {
    return {
      ok: false,
      violations: [],
      summary: { high: 0, medium: 0, low: 0 },
      parseError: parsed.error,
    };
  }

  const violations: SafeguardViolation[] = [];

  for (const doc of parsed.documents) {
    for (const rule of SAFEGUARD_RULES) {
      const paths = rule.check(doc);
      for (const path of paths) {
        violations.push({
          id: rule.id,
          title: rule.title,
          severity: rule.severity,
          message: rule.message,
          msprLink: rule.msprLink,
          autoFixable: rule.autoFixable,
          path,
        });
      }
    }
  }

  const summary = { high: 0, medium: 0, low: 0 };
  for (const v of violations) {
    summary[v.severity]++;
  }

  return {
    ok: violations.length === 0,
    violations,
    summary,
  };
}
