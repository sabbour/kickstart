import type { GuardrailContribution, GuardrailVerdict } from '@kickstart/harness';

/**
 * no-privileged-operations guardrail.
 *
 * Blocks tool calls that attempt to modify RBAC role assignments or role definitions
 * outside of the approved user-action path.
 *
 * Operates at the tool stage — intercepts before any ARM tool executes.
 */

const PRIVILEGED_PATH_PATTERNS = [
  /microsoft\.authorization\/roleassignments/i,
  /microsoft\.authorization\/roledefinitions/i,
  /microsoft\.authorization\/denyas signments/i,
  /microsoft\.classiccompute\/virtualmachines\/extensions/i,
];

interface ToolPayload {
  toolName?: string;
  parameters?: Record<string, unknown>;
  path?: string;
}

export const noPrivilegedOperationsGuardrail: GuardrailContribution = {
  name: 'azure/no-privileged-operations',
  stage: 'tool',
  appliesTo: ['azure.*'],
  check: async (_ctx, payload): Promise<GuardrailVerdict> => {
    const toolPayload = payload as ToolPayload | null;
    if (!toolPayload) return { kind: 'pass' };

    const pathToCheck =
      (toolPayload.parameters?.['path'] as string | undefined) ??
      (toolPayload.parameters?.['scopePath'] as string | undefined) ??
      toolPayload.path;

    if (!pathToCheck) return { kind: 'pass' };

    // Decode before checking to catch encoded traversals
    let decoded: string;
    try {
      decoded = decodeURIComponent(String(pathToCheck));
    } catch {
      decoded = String(pathToCheck);
    }

    for (const pattern of PRIVILEGED_PATH_PATTERNS) {
      if (pattern.test(decoded)) {
        return {
          kind: 'block',
          reason:
            `Privileged operation blocked: path "${decoded}" targets a protected Azure resource type ` +
            `(${String(pattern)}). RBAC modifications must go through an approved user-action.`,
        };
      }
    }

    return { kind: 'pass' };
  },
};
