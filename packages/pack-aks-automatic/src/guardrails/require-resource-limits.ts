import type { GuardrailContribution, GuardrailVerdict } from '@kickstart/harness';

/**
 * require-resource-limits guardrail.
 *
 * Blocks tool calls that would write Kubernetes manifests where a container
 * section is present but no resource limits are defined.
 *
 * Operates at the tool stage — intercepts before core.write_file executes.
 */

interface WriteFilePayload {
  toolName?: string;
  parameters?: {
    content?: string;
    path?: string;
  };
  content?: string;
}

function isKubernetesManifest(content: string): boolean {
  return /apiVersion:\s*\S/.test(content) && /kind:\s*\w+/.test(content);
}

export const requireResourceLimitsGuardrail: GuardrailContribution = {
  name: 'aks/require-resource-limits',
  stage: 'tool',
  appliesTo: ['core.write_file', 'aks.*'],
  check: async (_ctx, payload): Promise<GuardrailVerdict> => {
    const p = payload as WriteFilePayload | null;
    if (!p) return { kind: 'pass' };

    const content =
      (p.parameters?.['content'] as string | undefined) ?? p.content;
    if (!content || typeof content !== 'string') return { kind: 'pass' };
    if (!isKubernetesManifest(content)) return { kind: 'pass' };

    const hasContainers = /^\s+containers:/m.test(content);
    if (!hasContainers) return { kind: 'pass' };

    const hasLimits = /^\s+limits:/m.test(content);
    if (!hasLimits) {
      return {
        kind: 'block',
        reason:
          'AKS safeguard violation: manifest has containers without resource limits. ' +
          'All containers in an AKS Automatic cluster must declare resources.limits ' +
          '(CPU and memory) to prevent runaway resource consumption. ' +
          'Add a resources.limits block to each container specification.',
      };
    }

    return { kind: 'pass' };
  },
};
