import type { GuardrailContribution } from '@aks-kickstart/harness';
/**
 * Blocks file-write tool calls that contain credential-like patterns or
 * high-entropy tokens. Only fires on the `core/write_file` tool.
 *
 * @internal — fail-closed; not a security oracle stub.
 */
export declare const noSecretsInArtifactsGuardrail: GuardrailContribution;
//# sourceMappingURL=no_secrets_in_artifacts.d.ts.map