/**
 * Blocks tool calls that would write Kubernetes manifests containing
 * privileged containers (securityContext.privileged: true).
 */
function isKubernetesManifest(content) {
    return /apiVersion:\s*\S/.test(content) && /kind:\s*\w+/.test(content);
}
const DANGEROUS_CAPS = ['SYS_ADMIN', 'NET_ADMIN', 'ALL', 'SYS_PTRACE', 'SYS_MODULE', 'DAC_READ_SEARCH'];
export const noPrivilegedContainersGuardrail = {
    id: 'aks/no-privileged-containers',
    appliesTo: ['*'],
    stages: ['tool'],
    async evaluate(input) {
        const args = input.toolArgs;
        if (!args)
            return { verdict: 'pass' };
        const content = args['content'] ??
            (args['parameters'] != null && typeof args['parameters'] === 'object'
                ? args['parameters']['content']
                : undefined);
        if (!content || typeof content !== 'string')
            return { verdict: 'pass' };
        if (!isKubernetesManifest(content))
            return { verdict: 'pass' };
        if (/privileged:\s*true/.test(content)) {
            return {
                verdict: 'block',
                reason: 'AKS safeguard violation: manifest contains a privileged container ' +
                    '(securityContext.privileged: true). Privileged containers are prohibited ' +
                    'by the AKS Automatic pod security standard (Restricted). ' +
                    'Remove the privileged flag and use a more specific capability grant instead.',
            };
        }
        if (/allowPrivilegeEscalation:\s*true/.test(content)) {
            return {
                verdict: 'block',
                reason: 'AKS safeguard violation: manifest sets allowPrivilegeEscalation: true. ' +
                    'This is prohibited by the AKS Automatic Restricted pod security standard. ' +
                    'Set allowPrivilegeEscalation: false or omit the field.',
            };
        }
        const foundCap = DANGEROUS_CAPS.find((cap) => new RegExp(`-\\s+${cap}\\b`, 'i').test(content));
        if (foundCap) {
            return {
                verdict: 'block',
                reason: `AKS safeguard violation: manifest adds dangerous capability: ${foundCap.toUpperCase()}. ` +
                    'Containers must not add capabilities beyond the restricted set. ' +
                    'Remove the capability or use a more restrictive permission model.',
            };
        }
        return { verdict: 'pass' };
    },
};
//# sourceMappingURL=no-privileged-containers.js.map