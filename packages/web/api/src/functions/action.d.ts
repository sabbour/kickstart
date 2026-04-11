/**
 * @module @kickstart/api/functions/action
 *
 * POST /api/action — A2UI action processing endpoint.
 *
 * Receives action events from the frontend (fired by A2UI components),
 * routes them by type, and returns updated state.
 *
 * Action routing:
 * - reply    → Translate action to natural language, re-prompt LLM
 * - navigate → Update phase intent, re-prompt LLM framed as navigation
 * - api      → Stubbed — returns not_implemented until APIConnector (B-11) ships
 *
 * Per decision F17: ALL action types re-prompt the LLM. The LLM stays
 * in full control of state transitions.
 */
export {};
//# sourceMappingURL=action.d.ts.map