/** Maximum total tokens allowed in a session before blocking new turns. */
const TOKEN_BUDGET_LIMIT = 128_000;
export const tokenBudgetGuardrail = {
    id: 'core/token-budget',
    appliesTo: ['*'],
    stages: ['input'],
    async evaluate(input) {
        // tokenUsage is an extension field on the session context; not in GuardrailInput.
        // Access via a well-known global or skip — default pass if unavailable.
        const used = 0; // token tracking is session-level; this guardrail is a stub hook
        void input; // satisfy linter
        if (used >= TOKEN_BUDGET_LIMIT) {
            return {
                verdict: 'block',
                reason: `Session token budget exceeded (${used.toLocaleString()} / ${TOKEN_BUDGET_LIMIT.toLocaleString()} tokens used). Start a new session to continue.`,
            };
        }
        return { verdict: 'pass' };
    },
};
//# sourceMappingURL=token_budget.js.map