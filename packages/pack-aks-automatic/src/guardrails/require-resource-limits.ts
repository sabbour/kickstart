import type { GuardrailContribution, GuardrailInput, GuardrailResult } from '@aks-kickstart/harness';

/**
 * Blocks tool calls that would write Kubernetes manifests where containers
 * are present but no resource limits are defined.
 */

function isKubernetesManifest(content: string): boolean {
  return /apiVersion:\s*\S/.test(content) && /kind:\s*\w+/.test(content);
}

export const requireResourceLimitsGuardrail: GuardrailContribution = {
  id: 'aks/require-resource-limits',
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

    const hasContainers = /^\s+containers:/m.test(content);
    if (!hasContainers) return { verdict: 'pass' };

    const hasLimits = /^\s+limits:/m.test(content);
    if (!hasLimits) {
      return {
        verdict: 'block',
        reason:
          'AKS safeguard violation: manifest has containers without resource limits. ' +
          'All containers in an AKS Automatic cluster must declare resources.limits ' +
          '(CPU and memory) to prevent runaway resource consumption. ' +
          'Add a resources.limits block to each container specification.',
      };
    }

    return { verdict: 'pass' };
  },
};
