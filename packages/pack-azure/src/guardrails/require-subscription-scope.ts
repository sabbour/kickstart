import type { GuardrailContribution, GuardrailVerdict } from '@kickstart/harness';

/**
 * require-subscription-scope guardrail.
 *
 * Blocks azure tool calls that provide ARM paths without a subscription UUID prefix.
 * Enforces that all ARM paths are subscription-scoped per the ARM allowlist.
 *
 * Operates at the tool stage.
 */

const SUBSCRIPTION_UUID_RE =
  /^\/subscriptions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const AZURE_PATH_TOOLS = new Set([
  'azure.arm_get',
  'azure.what_if',
  'azure__arm_write',
  'azure__deploy',
]);

interface ToolPayload {
  toolName?: string;
  parameters?: Record<string, unknown>;
}

export const requireSubscriptionScopeGuardrail: GuardrailContribution = {
  name: 'azure/require-subscription-scope',
  stage: 'tool',
  appliesTo: ['azure.*'],
  check: async (_ctx, payload): Promise<GuardrailVerdict> => {
    const toolPayload = payload as ToolPayload | null;
    if (!toolPayload) return { kind: 'pass' };

    const toolName = toolPayload.toolName;
    if (!toolName || !AZURE_PATH_TOOLS.has(toolName)) return { kind: 'pass' };

    const params = toolPayload.parameters ?? {};
    const rawPath = (params['path'] as string | undefined) ?? (params['scopePath'] as string | undefined);
    if (!rawPath) return { kind: 'pass' };

    let decoded: string;
    try {
      decoded = decodeURIComponent(String(rawPath));
    } catch {
      decoded = String(rawPath);
    }

    if (!SUBSCRIPTION_UUID_RE.test(decoded)) {
      return {
        kind: 'block',
        reason:
          `ARM path "${decoded}" is not subscription-scoped. ` +
          `All Azure ARM paths must begin with /subscriptions/{uuid}. ` +
          `Please authenticate via azure:select_subscription and use a fully-qualified path.`,
      };
    }

    return { kind: 'pass' };
  },
};
