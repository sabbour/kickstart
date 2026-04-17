import type { GuardrailContribution } from '@kickstart/harness';

/** Maximum total tokens allowed in a session before blocking new turns. */
const TOKEN_BUDGET_LIMIT = 128_000;

export const tokenBudgetGuardrail: GuardrailContribution = {
  name: 'token-budget',
  stage: 'input',
  check: async (ctx, _payload) => {
    // tokenUsage is an extension field not yet in the base SessionCtx contract.
    const usage = (ctx as unknown as { tokenUsage?: { total?: number } }).tokenUsage;
    const used = usage?.total ?? 0;
    if (used >= TOKEN_BUDGET_LIMIT) {
      return {
        kind: 'block',
        reason: `Session token budget exceeded (${used.toLocaleString()} / ${TOKEN_BUDGET_LIMIT.toLocaleString()} tokens used). Start a new session to continue.`,
      };
    }
    return { kind: 'pass' };
  },
};
