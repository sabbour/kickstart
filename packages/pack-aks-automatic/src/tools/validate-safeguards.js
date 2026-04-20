import { tool } from '@openai/agents';
import { z } from 'zod';
import safeguardsConfig from '../safeguards.json';
function loadSafeguards() {
    const raw = safeguardsConfig;
    return Object.freeze(raw.rules.map((r) => Object.freeze({ ...r })));
}
const SAFEGUARD_RULES = loadSafeguards();
// ── Schema ────────────────────────────────────────────────────────────────────
const ValidateSafeguardsInputSchema = z.object({
    manifest: z
        .string()
        .min(1)
        .describe('Kubernetes YAML manifest content to check against AKS safeguards'),
    manifestName: z
        .string()
        .nullable()
        .optional()
        .describe('Optional display name for the manifest'),
});
const ViolationSchema = z.object({
    ruleId: z.string(),
    severity: z.enum(['high', 'medium', 'low']),
    description: z.string(),
    line: z.number().optional(),
});
const ValidateSafeguardsOutputSchema = z.object({
    compliant: z.boolean(),
    highCount: z.number(),
    mediumCount: z.number(),
    lowCount: z.number(),
    violations: z.array(ViolationSchema),
    summary: z.string(),
});
function findLineNumber(yaml, pattern) {
    const lines = yaml.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
            return i + 1;
        }
    }
    return undefined;
}
export function evaluateRules(yaml) {
    const violations = [];
    for (const rule of SAFEGUARD_RULES) {
        switch (rule.id) {
            case 'no-privileged':
                if (/privileged:\s*true/.test(yaml)) {
                    violations.push({
                        ruleId: rule.id,
                        severity: rule.severity,
                        description: rule.description,
                        line: findLineNumber(yaml, /privileged:\s*true/),
                    });
                }
                break;
            case 'require-limits': {
                // Check if there are containers but no limits section
                const hasContainers = /containers:/.test(yaml);
                const hasLimits = /limits:/.test(yaml);
                if (hasContainers && !hasLimits) {
                    violations.push({
                        ruleId: rule.id,
                        severity: rule.severity,
                        description: rule.description,
                        line: findLineNumber(yaml, /containers:/),
                    });
                }
                break;
            }
            case 'no-hostpath':
                if (/hostPath:/.test(yaml)) {
                    violations.push({
                        ruleId: rule.id,
                        severity: rule.severity,
                        description: rule.description,
                        line: findLineNumber(yaml, /hostPath:/),
                    });
                }
                break;
            case 'no-latest-tag':
                if (/image:\s*\S+:latest/.test(yaml)) {
                    violations.push({
                        ruleId: rule.id,
                        severity: rule.severity,
                        description: rule.description,
                        line: findLineNumber(yaml, /image:\s*\S+:latest/),
                    });
                }
                break;
            case 'no-privilege-escalation':
                if (/allowPrivilegeEscalation:\s*true/.test(yaml)) {
                    violations.push({
                        ruleId: rule.id,
                        severity: rule.severity,
                        description: rule.description,
                        line: findLineNumber(yaml, /allowPrivilegeEscalation:\s*true/),
                    });
                }
                break;
            case 'run-as-non-root': {
                // Flag if runAsNonRoot is explicitly false
                if (/runAsNonRoot:\s*false/.test(yaml)) {
                    violations.push({
                        ruleId: rule.id,
                        severity: rule.severity,
                        description: rule.description,
                        line: findLineNumber(yaml, /runAsNonRoot:\s*false/),
                    });
                }
                break;
            }
            case 'no-host-network':
                if (/hostNetwork:\s*true/.test(yaml)) {
                    violations.push({
                        ruleId: rule.id,
                        severity: rule.severity,
                        description: rule.description,
                        line: findLineNumber(yaml, /hostNetwork:\s*true/),
                    });
                }
                break;
            case 'no-host-pid':
                if (/hostPID:\s*true/.test(yaml)) {
                    violations.push({
                        ruleId: rule.id,
                        severity: rule.severity,
                        description: rule.description,
                        line: findLineNumber(yaml, /hostPID:\s*true/),
                    });
                }
                break;
            default:
                break;
        }
    }
    return violations;
}
// ── Tool ──────────────────────────────────────────────────────────────────────
export const validateSafeguardsTool = {
    name: 'aks.validate_safeguards',
    tool: tool({
        name: 'aks.validate_safeguards',
        description: 'Checks a Kubernetes YAML manifest against frozen AKS safeguard rules loaded from safeguards.json. ' +
            'Returns structured violations with rule IDs, severities, and line numbers. ' +
            'High-severity violations must be resolved before deployment.',
        parameters: ValidateSafeguardsInputSchema,
        execute: async (input) => {
            const name = input.manifestName ?? 'manifest';
            const violations = evaluateRules(input.manifest);
            const highCount = violations.filter((v) => v.severity === 'high').length;
            const mediumCount = violations.filter((v) => v.severity === 'medium').length;
            const lowCount = violations.filter((v) => v.severity === 'low').length;
            const compliant = violations.length === 0;
            let summary;
            if (compliant) {
                summary = `${name}: compliant with all AKS safeguards`;
            }
            else {
                const parts = [];
                if (highCount > 0)
                    parts.push(`${highCount} high`);
                if (mediumCount > 0)
                    parts.push(`${mediumCount} medium`);
                if (lowCount > 0)
                    parts.push(`${lowCount} low`);
                summary = `${name}: ${violations.length} violation${violations.length === 1 ? '' : 's'} (${parts.join(', ')})`;
            }
            return {
                compliant,
                highCount,
                mediumCount,
                lowCount,
                violations: violations.map((v) => ({
                    ruleId: v.ruleId,
                    severity: v.severity,
                    description: v.description,
                    line: v.line,
                })),
                summary,
            };
        },
    }),
};
// Export rules for use by guardrails (single source of truth)
export { SAFEGUARD_RULES };
//# sourceMappingURL=validate-safeguards.js.map