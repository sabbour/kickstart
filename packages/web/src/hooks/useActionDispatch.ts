import { useCallback, useRef } from 'react';
import type { A2uiClientAction } from '../vendor/a2ui/web_core/schema/client-to-server';

/**
 * Action routing categories.
 *
 * - reply:    Translate the action into natural language and re-prompt the LLM.
 *             This is the default for ALL actions (per decision F17).
 * - navigate: Phase-transition request — still re-prompts the LLM but framed
 *             as a navigation intent so the LLM can decide the next phase.
 * - api:      Direct API call — stubbed for ServiceConnector integration later.
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

export interface ActionDispatchOptions {
  /** Send a message to the conversation (re-prompts the LLM). */
  onSendMessage: (message: string) => void;
  /** Optional callback for navigate actions (in addition to re-prompting). */
  onNavigate?: (phase: string, context: Record<string, unknown>) => void;
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
 * - `api:*` → stub for ServiceConnector (logs warning, falls back to reply)
 */
export function useActionDispatch(options: ActionDispatchOptions): ActionHandler {
  // Use ref to avoid stale closure over onSendMessage
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
        // Stub: ServiceConnector will handle these in a future iteration.
        // For now, re-prompt the LLM so the user isn't left hanging.
        console.warn(
          `[ActionDispatch] api action "${action.name}" not yet connected. Falling back to LLM re-prompt.`,
          action,
        );
        optionsRef.current.onSendMessage(message);
        break;
      }
    }
  }, []);
}
