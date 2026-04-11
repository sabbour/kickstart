import { useCallback, useRef, useState } from 'react';
import { shouldAutoContinue, synthesizeContinuationPrompt, synthesizeNavigationPrompt, AUTO_CONTINUE_MAX_CONSECUTIVE, } from '@kickstart/core';
/** Prefix → category mapping. Actions without a known prefix default to 'reply'. */
const PREFIX_MAP = {
    'navigate:': 'navigate',
    'nav:': 'navigate',
    'api:': 'api',
    'complete:': 'auto-continue',
    'continue:': 'auto-continue',
};
function categorize(actionName) {
    for (const [prefix, category] of Object.entries(PREFIX_MAP)) {
        if (actionName.startsWith(prefix))
            return category;
    }
    return 'reply';
}
/**
 * Translates an A2UI action into a human-readable message suitable for
 * re-prompting the LLM. The LLM stays in full control of state transitions.
 */
function actionToMessage(action) {
    const { name, context } = action;
    // Strip any routing prefix for the message
    const cleanName = name.replace(/^(navigate:|nav:|api:)/, '');
    // Build context summary from key-value pairs
    const contextParts = [];
    if (context && typeof context === 'object') {
        for (const [key, value] of Object.entries(context)) {
            if (value !== undefined && value !== null && value !== '') {
                contextParts.push(`${key}: ${String(value)}`);
            }
        }
    }
    if (contextParts.length > 0) {
        return `[Action: ${cleanName}] ${contextParts.join(', ')}`;
    }
    return `[Action: ${cleanName}]`;
}
/**
 * Parses an `api:` action name into connector name + operation.
 *
 * Format: `api:{connectorName}.{operation}` (e.g. `api:azure-arm.listResources`)
 * Falls back to `{ connectorName: undefined, operation: fullActionName }` if
 * the format isn't followed.
 */
function parseApiAction(actionName) {
    const withoutPrefix = actionName.replace(/^api:/, '');
    const dotIndex = withoutPrefix.indexOf('.');
    if (dotIndex === -1) {
        return { connectorName: undefined, operation: withoutPrefix };
    }
    return {
        connectorName: withoutPrefix.slice(0, dotIndex),
        operation: withoutPrefix.slice(dotIndex + 1),
    };
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
export function useActionDispatch(options) {
    // Use ref to avoid stale closure over options
    const optionsRef = useRef(options);
    optionsRef.current = options;
    // Track consecutive auto-continues — use both ref (for immediate logic) and
    // state (to expose the current value to callers).
    const consecutiveRef = useRef(0);
    const [consecutiveAutoContinueCount, setConsecutiveAutoContinueCount] = useState(0);
    const resetConsecutiveCount = useCallback(() => {
        consecutiveRef.current = 0;
        setConsecutiveAutoContinueCount(0);
    }, []);
    /**
     * Dispatch an auto-continuation. Checks rate limit and calls onAutoContinue
     * (or falls back to onSendMessage) with the synthesized prompt.
     */
    const dispatchAutoContinue = useCallback((message) => {
        if (consecutiveRef.current >= AUTO_CONTINUE_MAX_CONSECUTIVE) {
            // eslint-disable-next-line no-console
            console.warn(`[ActionDispatch] Auto-continue rate limit reached ` +
                `(${AUTO_CONTINUE_MAX_CONSECUTIVE} consecutive). Waiting for user input.`);
            return;
        }
        consecutiveRef.current += 1;
        setConsecutiveAutoContinueCount(consecutiveRef.current);
        const { onAutoContinue, onSendMessage } = optionsRef.current;
        if (onAutoContinue) {
            onAutoContinue(message);
        }
        else {
            onSendMessage(message);
        }
    }, []);
    const handler = useCallback((action) => {
        const category = categorize(action.name);
        switch (category) {
            case 'reply': {
                // Manual action — reset the consecutive counter
                consecutiveRef.current = 0;
                setConsecutiveAutoContinueCount(0);
                const message = actionToMessage(action);
                optionsRef.current.onSendMessage(message);
                break;
            }
            case 'navigate': {
                const phase = action.name.replace(/^(navigate:|nav:)/, '');
                // Fire optional navigate callback for any local side effects
                optionsRef.current.onNavigate?.(phase, action.context ?? {});
                // Phase transitions auto-continue
                const message = synthesizeNavigationPrompt(phase, action.context ?? {});
                dispatchAutoContinue(message);
                break;
            }
            case 'auto-continue': {
                // Explicit completion signal — synthesize a continuation prompt
                if (!shouldAutoContinue(action.name)) {
                    // Shouldn't happen, but guard defensively
                    optionsRef.current.onSendMessage(actionToMessage(action));
                    break;
                }
                const message = synthesizeContinuationPrompt({
                    name: action.name,
                    context: action.context ?? {},
                });
                dispatchAutoContinue(message);
                break;
            }
            case 'api': {
                const registry = optionsRef.current.connectorRegistry;
                if (!registry) {
                    // eslint-disable-next-line no-console
                    console.warn(`[ActionDispatch] api action "${action.name}" — no connectorRegistry provided. Falling back to LLM re-prompt.`, action);
                    optionsRef.current.onSendMessage(actionToMessage(action));
                    break;
                }
                const { connectorName, operation } = parseApiAction(action.name);
                if (!connectorName) {
                    // eslint-disable-next-line no-console
                    console.warn(`[ActionDispatch] api action "${action.name}" has no connector name. ` +
                        `Expected format: api:{connectorName}.{operation}. Falling back to LLM re-prompt.`, action);
                    optionsRef.current.onSendMessage(actionToMessage(action));
                    break;
                }
                const connector = registry.get(connectorName);
                if (!connector) {
                    // eslint-disable-next-line no-console
                    console.warn(`[ActionDispatch] api action "${action.name}" — connector "${connectorName}" not found in registry. ` +
                        `Registered: [${registry.names().join(', ')}]. Falling back to LLM re-prompt.`, action);
                    optionsRef.current.onSendMessage(actionToMessage(action));
                    break;
                }
                // Connector found — invoke the operation if it exists as a method.
                const method = connector[operation];
                if (typeof method !== 'function') {
                    // eslint-disable-next-line no-console
                    console.warn(`[ActionDispatch] api action "${action.name}" — connector "${connectorName}" has no method "${operation}". Falling back to LLM re-prompt.`, action);
                    optionsRef.current.onSendMessage(actionToMessage(action));
                    break;
                }
                // Fire-and-forget: re-prompt the LLM with the result so the conversation stays coherent.
                Promise.resolve()
                    .then(() => method.call(connector, action.context))
                    .then((result) => {
                    const resultSummary = result !== undefined
                        ? `[API Result: ${connectorName}.${operation}] ${JSON.stringify(result)}`
                        : `[API Result: ${connectorName}.${operation}] success`;
                    optionsRef.current.onSendMessage(resultSummary);
                })
                    .catch((err) => {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    // eslint-disable-next-line no-console
                    console.error(`[ActionDispatch] api action "${action.name}" failed:`, err);
                    optionsRef.current.onSendMessage(`[API Error: ${connectorName}.${operation}] ${errMsg}`);
                });
                break;
            }
        }
    }, [dispatchAutoContinue]);
    return { handler, resetConsecutiveCount, consecutiveAutoContinueCount };
}
//# sourceMappingURL=useActionDispatch.js.map