import type { GuardrailContribution, GuardrailVerdict } from '@kickstart/harness';

/**
 * no-hostpath-volumes guardrail.
 *
 * Blocks tool calls that would write Kubernetes manifests containing
 * hostPath volumes. hostPath mounts grant containers access to the node
 * filesystem, violating the AKS Automatic Restricted pod security standard.
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

export const noHostpathVolumesGuardrail: GuardrailContribution = {
  name: 'aks/no-hostpath-volumes',
  stage: 'tool',
  appliesTo: ['core.write_file', 'aks.*'],
  check: async (_ctx, payload): Promise<GuardrailVerdict> => {
    const p = payload as WriteFilePayload | null;
    if (!p) return { kind: 'pass' };

    const content =
      (p.parameters?.['content'] as string | undefined) ?? p.content;
    if (!content || typeof content !== 'string') return { kind: 'pass' };
    if (!isKubernetesManifest(content)) return { kind: 'pass' };

    if (/hostPath:/m.test(content)) {
      return {
        kind: 'block',
        reason:
          'AKS safeguard violation: manifest contains a hostPath volume. ' +
          'hostPath volumes mount the node filesystem into the container, ' +
          'which is prohibited by the AKS Automatic Restricted pod security standard. ' +
          'Use a PersistentVolumeClaim (managed-csi or azurefile-csi storage class) instead.',
      };
    }

    return { kind: 'pass' };
  },
};
