import type { GuardrailContribution, GuardrailInput, GuardrailResult } from '@kickstart/harness';

/**
 * Blocks Kubernetes manifests that reference container images with the
 * `latest` tag. Using `latest` prevents reproducible deployments and
 * makes rollbacks unreliable.
 */

function isKubernetesManifest(content: string): boolean {
  return /apiVersion:\s*\S/.test(content) && /kind:\s*\w+/.test(content);
}

/** Matches `image: foo:latest` (explicit latest tag) */
const EXPLICIT_LATEST_PATTERN = /^\s+image:\s*\S+:latest\s*$/m;

export const noLatestTagGuardrail: GuardrailContribution = {
  id: 'aks/no-latest-tag',
  appliesTo: ['*'],
  stages: ['tool'],
  async evaluate(input: GuardrailInput): Promise<GuardrailResult> {
    const args = input.toolArgs;
    if (!args) return { verdict: 'pass' };

    const content =
      (args['content'] as string | undefined) ??
      (args['parameters'] != null && typeof args['parameters'] === 'object'
        ? ((args['parameters'] as Record<string, unknown>)['content'] as string | undefined)
        : undefined);

    if (!content || typeof content !== 'string') return { verdict: 'pass' };
    if (!isKubernetesManifest(content)) return { verdict: 'pass' };

    if (EXPLICIT_LATEST_PATTERN.test(content)) {
      return {
        verdict: 'block',
        reason:
          'AKS safeguard violation: manifest uses `:latest` image tag. ' +
          'Pin your container image to a specific digest or version tag (e.g., image: myacr.azurecr.io/app:1.2.3) ' +
          'to ensure reproducible deployments and enable reliable rollbacks.',
      };
    }

    return { verdict: 'pass' };
  },
};
