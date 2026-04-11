import type { A2uiClientAction } from '../vendor/a2ui/web_core/schema/client-to-server';
import type { APIConnectorRegistry } from '@kickstart/core';
export interface ActionDispatchOptions {
    /** Send a message to the conversation (re-prompts the LLM). */
    onSendMessage: (message: string) => void;
    /**
     * Send an auto-generated continuation message (no user bubble shown).
     * Falls back to onSendMessage if not provided.
     */
    onAutoContinue?: (message: string) => void;
    /** Optional callback for navigate actions (in addition to re-prompting). */
    onNavigate?: (phase: string, context: Record<string, unknown>) => void;
    /**
     * Optional APIConnectorRegistry — when provided, `api:` actions are routed
     * to the matching connector instead of falling back to the LLM.
     *
     * Action name format: `api:{connectorName}.{operation}`
     * e.g. `api:azure-arm.listResources`
     */
    connectorRegistry?: APIConnectorRegistry;
}
export type ActionHandler = (action: A2uiClientAction) => void;
export interface ActionDispatchResult {
    /** The action handler to pass to useA2UI. */
    handler: ActionHandler;
    /** Reset the consecutive auto-continue counter (call when the user manually sends a message). */
    resetConsecutiveCount: () => void;
    /** Number of consecutive auto-continues since the last manual message or reset. */
    consecutiveAutoContinueCount: number;
}
/**
 * Creates an action handler that routes A2UI component actions.
 *
 * The core pattern (from decision F17): button clicks are translated into
 * natural language and re-prompt the LLM. The LLM decides what happens next.
 *
 * Four routing categories exist:
 * - Default / `reply`         → translate to message, send to conversation
 * - `navigate:*` / `nav:*`    → auto-continue with synthesized navigation prompt
 * - `complete:*` / `continue:*` → auto-continue with synthesized completion prompt
 * - `api:*`                   → route to APIConnectorRegistry if available, otherwise fall back
 *                               to LLM re-prompt with a console warning
 *
 * Auto-continues are rate-limited to AUTO_CONTINUE_MAX_CONSECUTIVE consecutive calls.
 * Call resetConsecutiveCount() when the user manually sends a message.
 */
export declare function useActionDispatch(options: ActionDispatchOptions): ActionDispatchResult;
//# sourceMappingURL=useActionDispatch.d.ts.map