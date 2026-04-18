import type { GuardrailContribution, GuardrailInput, GuardrailResult } from '@kickstart/harness';

/**
 * Blocks Azure tool calls with ARM paths that are not subscription-scoped.
 */

const SUBSCRIPTION_UUID_RE =
  /^\/subscriptions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const AZURE_PATH_TOOLS = new Set([
  'azure.arm_get',
  'azure.what_if',
  'azure.arm_write',
  'azure.deploy',
]);

export const requireSubscriptionScopeGuardrail: GuardrailContribution = {
  id: 'azure/require-subscription-scope',
  appliesTo: ['*'],
  stages: ['tool'],
  async evaluate(input: GuardrailInput): Promise<GuardrailResult> {
    const toolName = input.toolName;
    if (!toolName || !AZURE_PATH_TOOLS.has(toolName)) return { verdict: 'pass' };

    const args = input.toolArgs ?? {};
    const rawPath = (args['path'] as string | undefined) ?? (args['scopePath'] as string | undefined);
    if (!rawPath) return { verdict: 'pass' };

    let decoded: string;
    try {
      decoded = decodeURIComponent(String(rawPath));
    } catch {
      decoded = String(rawPath);
    }

    if (!SUBSCRIPTION_UUID_RE.test(decoded)) {
      return {
        verdict: 'block',
        reason:
          `ARM path "${decoded}" is not subscription-scoped. ` +
          `All Azure ARM paths must begin with /subscriptions/{uuid}. ` +
          `Please authenticate via azure:select_subscription and use a fully-qualified path.`,
      };
    }

    return { verdict: 'pass' };
  },
};
