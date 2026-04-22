import type { ToolContribution } from '@aks-kickstart/harness';
interface SafeguardRule {
    readonly id: string;
    readonly severity: 'high' | 'medium' | 'low';
    readonly description: string;
    readonly check: string;
}
declare const SAFEGUARD_RULES: readonly SafeguardRule[];
export interface Violation {
    ruleId: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    line?: number;
}
export declare function evaluateRules(yaml: string): Violation[];
export declare const validateSafeguardsTool: ToolContribution;
export { SAFEGUARD_RULES };
//# sourceMappingURL=validate-safeguards.d.ts.map