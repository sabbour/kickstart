/**
 * Blocks tool calls that attempt to modify RBAC role assignments or role
 * definitions outside of the approved user-action path.
 */
const PRIVILEGED_PATH_PATTERNS = [
    /microsoft\.authorization\/roleassignments/i,
    /microsoft\.authorization\/roledefinitions/i,
    /microsoft\.authorization\/denyassignments/i,
    /microsoft\.classiccompute\/virtualmachines\/extensions/i,
];
export const noPrivilegedOperationsGuardrail = {
    id: 'azure/no-privileged-operations',
    appliesTo: ['*'],
    stages: ['tool'],
    async evaluate(input) {
        const args = input.toolArgs;
        if (!args)
            return { verdict: 'pass' };
        const pathToCheck = args['path'] ??
            args['scopePath'];
        if (!pathToCheck)
            return { verdict: 'pass' };
        let decoded;
        try {
            decoded = decodeURIComponent(String(pathToCheck));
        }
        catch {
            decoded = String(pathToCheck);
        }
        for (const pattern of PRIVILEGED_PATH_PATTERNS) {
            if (pattern.test(decoded)) {
                return {
                    verdict: 'block',
                    reason: `Privileged operation blocked: path "${decoded}" targets a protected Azure resource type ` +
                        `(${String(pattern)}). RBAC modifications must go through an approved user-action.`,
                };
            }
        }
        return { verdict: 'pass' };
    },
};
//# sourceMappingURL=no-privileged-operations.js.map