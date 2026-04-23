import type { GuardrailContribution, GuardrailInput, GuardrailResult } from '@aks-kickstart/harness';

/**
 * Blocks RBAC role assignments that would give Owner role at subscription scope.
 *
 * Owner at subscription scope grants full control over all resources in the
 * subscription, including the ability to assign roles. This must go through
 * an approved user-action, not an autonomous tool call.
 */

// Azure built-in Owner role definition ID
const OWNER_ROLE_ID = '8e3af657-a8ff-443c-a75c-2fe8c4bcb635';
const OWNER_ROLE_PATTERN = /\bOwner\b/i;
const SUBSCRIPTION_SCOPE_PATTERN = /^\/subscriptions\/[0-9a-f-]{36}\/?$/i;

function extractText(value: unknown): string {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return ''; }
}

export const noSubscriptionScopedOwnerGuardrail: GuardrailContribution = {
  id: 'azure/no-subscription-scoped-owner',
  appliesTo: ['*'],
  stages: ['tool'],
  async evaluate(input: GuardrailInput): Promise<GuardrailResult> {
    const args = input.toolArgs ?? {};
    const text = extractText(args);

    // Check for Owner role definition ID in the args
    const hasOwnerRoleId = text.includes(OWNER_ROLE_ID);
    const hasOwnerRoleName = OWNER_ROLE_PATTERN.test(text);
    if (!hasOwnerRoleId && !hasOwnerRoleName) return { verdict: 'pass' };

    // Check if the scope is subscription-level
    const scope =
      (args['scope'] as string | undefined) ??
      (args['scopePath'] as string | undefined) ??
      (args['path'] as string | undefined);

    if (!scope) return { verdict: 'pass' };

    let decoded: string;
    try {
      decoded = decodeURIComponent(String(scope));
    } catch {
      decoded = String(scope);
    }

    if (SUBSCRIPTION_SCOPE_PATTERN.test(decoded)) {
      return {
        verdict: 'block',
        reason:
          `Role assignment blocked: granting Owner at subscription scope "${decoded}" is prohibited. ` +
          `Subscription-scoped Owner assignments must go through an approved user-action with explicit consent.`,
      };
    }

    return { verdict: 'pass' };
  },
};
