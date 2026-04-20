import type { ToolContribution } from '@kickstart/harness';
/**
 * Allowlist: anchored patterns covering valid GitHub REST API paths.
 * decodeURIComponent is applied FIRST, then the two-step check.
 */
export declare const GITHUB_API_PATH_ALLOWLIST: RegExp[];
/**
 * Forbidden sequences: path traversal and double-slash variants.
 */
export declare const FORBIDDEN_SEQ: RegExp;
export declare function validateGithubPath(rawPath: string): void;
export declare const apiGetTool: ToolContribution;
//# sourceMappingURL=api-get.d.ts.map