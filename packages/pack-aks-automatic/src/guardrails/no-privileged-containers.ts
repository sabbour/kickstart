import type { GuardrailContribution, GuardrailVerdict } from '@kickstart/harness';

/**
 * no-privileged-containers guardrail.
 *
 * Blocks tool calls that would write Kubernetes manifests containing
 * privileged containers (securityContext.privileged: true).
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

export const noPrivilegedContainersGuardrail: GuardrailContribution = {
  name: 'aks/no-privileged-containers',
  stage: 'tool',
  appliesTo: ['core.write_file', 'aks.*'],
  check: async (_ctx, payload): Promise<GuardrailVerdict> => {
    const p = payload as WriteFilePayload | null;
    if (!p) return { kind: 'pass' };

    const content =
      (p.parameters?.['content'] as string | undefined) ?? p.content;
    if (!content || typeof content !== 'string') return { kind: 'pass' };
    if (!isKubernetesManifest(content)) return { kind: 'pass' };

    if (/privileged:\s*true/.test(content)) {
      return {
        kind: 'block',
        reason:
          'AKS safeguard violation: manifest contains a privileged container ' +
          '(securityContext.privileged: true). Privileged containers are prohibited ' +
          'by the AKS Automatic pod security standard (Restricted). ' +
          'Remove the privileged flag and use a more specific capability grant instead.',
      };
    }

    if (/allowPrivilegeEscalation:\s*true/.test(content)) {
      return {
        kind: 'block',
        reason:
          'AKS safeguard violation: manifest sets allowPrivilegeEscalation: true. ' +
          'This is prohibited by the AKS Automatic Restricted pod security standard. ' +
          'Set allowPrivilegeEscalation: false or omit the field.',
      };
    }

    const DANGEROUS_CAPS = ['SYS_ADMIN', 'NET_ADMIN', 'ALL', 'SYS_PTRACE', 'SYS_MODULE', 'DAC_READ_SEARCH'];
    const foundCap = DANGEROUS_CAPS.find((cap) =>
      new RegExp(`-\\s+${cap}\\b`, 'i').test(content)
    );
    if (foundCap) {
      return {
        kind: 'block',
        reason:
          `AKS safeguard violation: manifest adds dangerous capability: ${foundCap.toUpperCase()}. ` +
          'Containers must not add capabilities beyond the restricted set. ' +
          'Remove the capability or use a more restrictive permission model.',
      };
    }

    return { kind: 'pass' };
  },
};
