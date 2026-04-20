import type { ToolContribution } from '@kickstart/harness';
/**
 * Allowlist: path must be subscription-UUID scoped.
 * Accepts:
 *   /subscriptions/{uuid}
 *   /subscriptions/{uuid}/resourceGroups/{rg}
 *   /subscriptions/{uuid}/resourceGroups/{rg}/providers/{ns}/{type}/{name}[/{sub-type}/{sub-name}...]
 */
export declare const ARM_PATH_RE: RegExp;
/**
 * Denylist: rejects path traversals and privileged control-plane paths.
 */
export declare const ARM_PATH_DENY: RegExp;
export declare function validateArmPath(rawPath: string): string;
export declare const armGetTool: ToolContribution;
//# sourceMappingURL=arm-get.d.ts.map