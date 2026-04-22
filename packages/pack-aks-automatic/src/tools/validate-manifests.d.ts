import type { ToolContribution } from '@aks-kickstart/harness';
export interface ManifestDiagnostic {
    severity: 'error' | 'warning';
    message: string;
    line?: number;
}
export declare function staticValidateManifest(yaml: string): ManifestDiagnostic[];
export declare function kubectlDryRun(yaml: string): Promise<{
    passed: boolean;
    output: string;
    toolMissing?: boolean;
}>;
export declare const validateManifestsTool: ToolContribution;
//# sourceMappingURL=validate-manifests.d.ts.map