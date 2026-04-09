import { useCallback, useRef } from 'react';
import type { A2uiClientAction } from '../vendor/a2ui/web_core/schema/client-to-server';
import type { APIConnectorRegistry } from '@kickstart/core';

/**
 * Action routing categories.
 *
 * - reply:    Translate the action into natural language and re-prompt the LLM.
 *             This is the default for ALL actions (per decision F17).
 * - navigate: Phase-transition request — still re-prompts the LLM but framed
 *             as a navigation intent so the LLM can decide the next phase.
 * - api:      Direct API call — routed through APIConnectorRegistry (B-11).
 */
type ActionCategory = 'reply' | 'navigate' | 'api';

/** Prefix → category mapping. Actions without a known prefix default to 'reply'. */
const PREFIX_MAP: Record<string, ActionCategory> = {
  'navigate:': 'navigate',
  'nav:': 'navigate',
  'api:': 'api',
};

function categorize(actionName: string): ActionCategory {
  for (const [prefix, category] of Object.entries(PREFIX_MAP)) {
    if (actionName.startsWith(prefix)) return category;
  }
  return 'reply';
}

/**
 * Translates an A2UI action into a human-readable message suitable for
 * re-prompting the LLM. The LLM stays in full control of state transitions.
 */
function actionToMessage(action: A2uiClientAction): string {
  const { name, context } = action;

  // Strip any routing prefix for the message
  const cleanName = name.replace(/^(navigate:|nav:|api:)/, '');

  // Build context summary from key-value pairs
  const contextParts: string[] = [];
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
function parseApiAction(actionName: string): { connectorName: string | undefined; operation: string } {
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

export interface ActionDispatchOptions {
  /** Send a message to the conversation (re-prompts the LLM). */
  onSendMessage: (message: string) => void;
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

/**
 * Creates an action handler that routes A2UI component actions.
 *
 * The core pattern (from decision F17): button clicks are translated into
 * natural language and re-prompt the LLM. The LLM decides what happens next.
 *
 * Three routing categories exist:
 * - Default / `reply` → translate to message, send to conversation
 * - `navigate:*` → re-prompt with navigation intent
 * - `api:*` → route to APIConnectorRegistry if available, otherwise fall back
 *             to LLM re-prompt with a console warning
 */
export function useActionDispatch(options: ActionDispatchOptions): ActionHandler {
  // Use ref to avoid stale closure over options
  const optionsRef = useRef(options);
  optionsRef.current = options;

  return useCallback((action: A2uiClientAction) => {
    const category = categorize(action.name);
    const message = actionToMessage(action);

    switch (category) {
      case 'reply': {
        optionsRef.current.onSendMessage(message);
        break;
      }

      case 'navigate': {
        // Fire optional navigate callback for any local side effects
        const phase = action.name.replace(/^(navigate:|nav:)/, '');
        optionsRef.current.onNavigate?.(phase, action.context ?? {});
        // Always re-prompt — LLM controls phase transitions
        optionsRef.current.onSendMessage(message);
        break;
      }

      case 'api': {
        const registry = optionsRef.current.connectorRegistry;
        if (!registry) {
          console.warn(
            `[ActionDispatch] api action "${action.name}" — no connectorRegistry provided. Falling back to LLM re-prompt.`,
            action,
          );
          optionsRef.current.onSendMessage(message);
          break;
        }

        const { connectorName, operation } = parseApiAction(action.name);
        if (!connectorName) {
          console.warn(
            `[ActionDispatch] api action "${action.name}" has no connector name. ` +
            `Expected format: api:{connectorName}.{operation}. Falling back to LLM re-prompt.`,
            action,
          );
          optionsRef.current.onSendMessage(message);
          break;
        }

        const connector = registry.get(connectorName);
        if (!connector) {
          console.warn(
            `[ActionDispatch] api action "${action.name}" — connector "${connectorName}" not found in registry. ` +
            `Registered: [${registry.names().join(', ')}]. Falling back to LLM re-prompt.`,
            action,
          );
          optionsRef.current.onSendMessage(message);
          break;
        }

        // Connector found — invoke the operation if it exists as a method.
        const method = (connector as Record<string, unknown>)[operation];
        if (typeof method !== 'function') {
          console.warn(
            `[ActionDispatch] api action "${action.name}" — connector "${connectorName}" has no method "${operation}". Falling back to LLM re-prompt.`,
            action,
          );
          optionsRef.current.onSendMessage(message);
          break;
        }

        // Fire-and-forget: re-prompt the LLM with the result so the conversation stays coherent.
        Promise.resolve()
          .then(() => (method as Function).call(connector, action.context))
          .then((result: unknown) => {
            const resultSummary = result !== undefined
              ? `[API Result: ${connectorName}.${operation}] ${JSON.stringify(result)}`
              : `[API Result: ${connectorName}.${operation}] success`;
            optionsRef.current.onSendMessage(resultSummary);
          })
          .catch((err: unknown) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[ActionDispatch] api action "${action.name}" failed:`, err);
            optionsRef.current.onSendMessage(
              `[API Error: ${connectorName}.${operation}] ${errMsg}`,
            );
          });
        break;
      }
    }
  }, []);
}
