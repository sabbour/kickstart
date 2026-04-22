/**
 * Blocks tool calls that would write Kubernetes manifests containing
 * hostPath volumes (AKS Automatic Restricted pod security standard).
 */
function isKubernetesManifest(content) {
    return /apiVersion:\s*\S/.test(content) && /kind:\s*\w+/.test(content);
}
export const noHostpathVolumesGuardrail = {
    id: 'aks/no-hostpath-volumes',
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
        if (/hostPath:/m.test(content)) {
            return {
                verdict: 'block',
                reason: 'AKS safeguard violation: manifest contains a hostPath volume. ' +
                    'hostPath volumes mount the node filesystem into the container, ' +
                    'which is prohibited by the AKS Automatic Restricted pod security standard. ' +
                    'Use a PersistentVolumeClaim (managed-csi or azurefile-csi storage class) instead.',
            };
        }
        return { verdict: 'pass' };
    },
};
//# sourceMappingURL=no-hostpath-volumes.js.map