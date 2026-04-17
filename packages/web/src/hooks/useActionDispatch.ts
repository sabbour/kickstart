import { useCallback, useRef, useState } from 'react';
import type { A2uiClientAction } from '../vendor/a2ui/web_core/schema/client-to-server';
import type { APIConnectorRegistry } from '@kickstart/harness';
import {
  shouldAutoContinue,
  synthesizeContinuationPrompt,
  synthesizeNavigationPrompt,
  AUTO_CONTINUE_MAX_CONSECUTIVE,
} from '@kickstart/harness';
import { sanitizeActionContext } from '../utils/sanitize-action-context';
import type { UserActionReqPayload } from './useStreaming';

// ---------------------------------------------------------------------------
// v2 UserAction resume dispatch
// ---------------------------------------------------------------------------

export interface UserActionResumeOptions {
  /**
   * Called when the resume SSE stream starts emitting events.
   * Provide the same callbacks you'd pass to useStreaming.send().
   */
  onResumeStream?: (eventSource: ReadableStreamDefaultReader<Uint8Array>) => void;
  /**
   * Called on successful resume (200 OK, stream started).
   */
  onSuccess?: () => void;
  /**
   * Called when the resume request fails (network error, 400, 403, etc.).
   */
  onError?: (message: string) => void;
}

/**
 * Dispatches a UserAction result to POST /api/converse/resume.
 *
 * Client input ONLY — the result payload is provided by the browser (MSAL token,
 * user form input, etc.). Never pass server-internal primitives.
 *
 * Zapp Critical 3: Playground stub invocation is guarded server-side.
 */
export async function dispatchUserActionResult(
  payload: UserActionReqPayload,
  result: unknown,
  options: UserActionResumeOptions = {},
): Promise<void> {
  const { onSuccess, onError } = options;

  try {
    const res = await fetch('/api/converse/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: payload.sessionId,
        actionId: payload.actionId,
        toolName: payload.toolName,
        result,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      const msg = (errorBody as { error?: string }).error ?? `Resume failed: ${res.status}`;
      onError?.(msg);
      return;
    }

    onSuccess?.();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'UserAction resume failed';
    onError?.(msg);
  }
}

/**
 * React hook for dispatching UserAction resume calls.
 * Returns a stable `handleUserActionRequired` callback and loading state.
 */
export function useUserActionDispatch() {
  const [isPending, setIsPending] = useState(false);

  const handleUserActionRequired = useCallback(
    async (payload: UserActionReqPayload, result: unknown, options?: UserActionResumeOptions) => {
      setIsPending(true);
      try {
        await dispatchUserActionResult(payload, result, options);
      } finally {
        setIsPending(false);
      }
    },
    [],
  );

  return { handleUserActionRequired, isPending };
}


/**
 * Action routing categories.
 *
 * - reply:         Translate the action into natural language and re-prompt the LLM.
 *                  This is the default for ALL actions (per decision F17).
 * - navigate:      Phase-transition request — auto-continues the conversation with a
 *                  synthesized prompt framing the navigation as a phase transition.
 * - auto-continue: Explicit completion signal (complete: / continue: prefix) — the
 *                  conversation advances automatically with a synthesized prompt.
 * - api:           Direct API call — routed through APIConnectorRegistry (B-11).
 * - client:        Client-side action (download, open panel) — routed to onClientAction
 *                  callback. Never sent to the LLM.
 */
type ActionCategory = 'reply' | 'navigate' | 'auto-continue' | 'api' | 'client';

/** Prefix → category mapping. Actions without a known prefix default to 'reply'. */
const PREFIX_MAP: Record<string, ActionCategory> = {
  'navigate:': 'navigate',
  'nav:': 'navigate',
  'api:': 'api',
  'complete:': 'auto-continue',
  'continue:': 'auto-continue',
  'client:': 'client',
};

function categorize(actionName: string): ActionCategory {
  for (const [prefix, category] of Object.entries(PREFIX_MAP)) {
    if (actionName.startsWith(prefix)) return category;
  }
  return 'reply';
}

/**
 * Translates an A2UI action into a human-readable message suitable for
 * re-prompting the LLM. Prefers showing the selected value over raw
 * action metadata so the chat bubble reads naturally (e.g. "Web API").
 *
 * Priority order:
 *   1. `selectedLabel` — the human-readable label of the chosen option
 *   2. `value` / `selectedValue` — the machine value of the selection
 *   3. A compact summary of non-internal context keys
 *   4. The clean action name as a last resort
 */
function actionToMessage(action: A2uiClientAction): string {
  const { name, context } = action;

  // Strip any routing prefix for the message
  const cleanName = name.replace(/^(navigate:|nav:|api:|complete:|continue:|client:)/, '');

  if (context && typeof context === 'object') {
    // 1. Prefer selectedLabel — human-readable chosen option (injected by enriched components)
    if (typeof context.selectedLabel === 'string' && context.selectedLabel) {
      return context.selectedLabel;
    }

    // 2. Prefer label — the button's user-facing text (e.g. "Looks good, generate the project")
    if (typeof context.label === 'string' && context.label) {
      return context.label;
    }

    // 3. Prefer value / selectedValue — the user's actual selection
    const rawValue = context.value ?? context.selectedValue;
    if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
      const valueStr = Array.isArray(rawValue) ? rawValue.join(', ') : String(rawValue);
      if (valueStr) {
        return valueStr;
      }
    }

    // 4. Build a compact summary from non-internal context keys (sanitized)
    const INTERNAL_KEYS = new Set(['label', 'selectedLabel', 'value', 'selectedValue']);
    const safeCtx = sanitizeActionContext(context);
    const contextParts: string[] = [];
    for (const [key, value] of Object.entries(safeCtx)) {
      if (INTERNAL_KEYS.has(key)) continue;
      if (value !== undefined && value !== null && value !== '') {
        contextParts.push(`${key}: ${String(value)}`);
      }
    }
    if (contextParts.length > 0) {
      return `${cleanName} (${contextParts.join(', ')})`;
    }
  }

  return cleanName;
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
  /** Optional debug logger — called with action details when debug mode is active. */
  onDebugAction?: (event: { actionName: string; category: string; context: Record<string, unknown>; outboundMessage: string }) => void;
  /** Callback for client-side actions (download, open panel, etc.). */
  onClientAction?: (operation: string, context: Record<string, unknown>) => void;
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
 * - `client:*`               → client-side action (download, open panel) — routed to onClientAction
 *
 * Auto-continues are rate-limited to AUTO_CONTINUE_MAX_CONSECUTIVE consecutive calls.
 * Call resetConsecutiveCount() when the user manually sends a message.
 */
export function useActionDispatch(options: ActionDispatchOptions): ActionDispatchResult {
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
  const dispatchAutoContinue = useCallback((message: string) => {
    if (consecutiveRef.current >= AUTO_CONTINUE_MAX_CONSECUTIVE) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ActionDispatch] Auto-continue rate limit reached ` +
        `(${AUTO_CONTINUE_MAX_CONSECUTIVE} consecutive). Waiting for user input.`,
      );
      return;
    }

    consecutiveRef.current += 1;
    setConsecutiveAutoContinueCount(consecutiveRef.current);

    const { onAutoContinue, onSendMessage } = optionsRef.current;
    if (onAutoContinue) {
      onAutoContinue(message);
    } else {
      onSendMessage(message);
    }
  }, []);

  const handler = useCallback((action: A2uiClientAction) => {
    const category = categorize(action.name);

    /** Log to debug logger if provided. */
    function logDebug(outboundMessage: string) {
      optionsRef.current.onDebugAction?.({
        actionName: action.name,
        category,
        context: (action.context ?? {}) as Record<string, unknown>,
        outboundMessage,
      });
    }

    switch (category) {
      case 'reply': {
        // Manual action — reset the consecutive counter
        consecutiveRef.current = 0;
        setConsecutiveAutoContinueCount(0);
        const message = actionToMessage(action);
        logDebug(message);
        optionsRef.current.onSendMessage(message);
        break;
      }

      case 'navigate': {
        const phase = action.name.replace(/^(navigate:|nav:)/, '');
        const safeContext = sanitizeActionContext(action.context);
        // Fire optional navigate callback for any local side effects
        optionsRef.current.onNavigate?.(phase, safeContext);
        // Phase transitions auto-continue
        const message = synthesizeNavigationPrompt(phase, safeContext);
        logDebug(message);
        dispatchAutoContinue(message);
        break;
      }

      case 'auto-continue': {
        // Explicit completion signal — synthesize a continuation prompt
        if (!shouldAutoContinue(action.name)) {
          // Shouldn't happen, but guard defensively
          const message = actionToMessage(action);
          logDebug(message);
          optionsRef.current.onSendMessage(message);
          break;
        }
        const safeContext = sanitizeActionContext(action.context);
        const message = synthesizeContinuationPrompt({
          name: action.name,
          context: safeContext,
        });
        logDebug(message);
        dispatchAutoContinue(message);
        break;
      }

      case 'api': {
        const registry = optionsRef.current.connectorRegistry;
        if (!registry) {
          // eslint-disable-next-line no-console
          console.warn(
            `[ActionDispatch] api action "${action.name}" — no connectorRegistry provided. Falling back to LLM re-prompt.`,
            action,
          );
          optionsRef.current.onSendMessage(actionToMessage(action));
          break;
        }

        const { connectorName, operation } = parseApiAction(action.name);
        if (!connectorName) {
          // eslint-disable-next-line no-console
          console.warn(
            `[ActionDispatch] api action "${action.name}" has no connector name. ` +
            `Expected format: api:{connectorName}.{operation}. Falling back to LLM re-prompt.`,
            action,
          );
          optionsRef.current.onSendMessage(actionToMessage(action));
          break;
        }

        const connector = registry.get(connectorName);
        if (!connector) {
          // eslint-disable-next-line no-console
          console.warn(
            `[ActionDispatch] api action "${action.name}" — connector "${connectorName}" not found in registry. ` +
            `Registered: [${registry.names().join(', ')}]. Falling back to LLM re-prompt.`,
            action,
          );
          optionsRef.current.onSendMessage(actionToMessage(action));
          break;
        }

        // Connector found — invoke the operation if it exists as a method.
        const method = (connector as unknown as Record<string, unknown>)[operation];
        if (typeof method !== 'function') {
          // eslint-disable-next-line no-console
          console.warn(
            `[ActionDispatch] api action "${action.name}" — connector "${connectorName}" has no method "${operation}". Falling back to LLM re-prompt.`,
            action,
          );
          optionsRef.current.onSendMessage(actionToMessage(action));
          break;
        }

        // Fire-and-forget: re-prompt the LLM with the result so the conversation stays coherent.
        Promise.resolve()
          .then(() => (method as (...args: unknown[]) => unknown).call(connector, action.context))
          .then((result: unknown) => {
            const resultSummary = result !== undefined
              ? `[API Result: ${connectorName}.${operation}] ${JSON.stringify(result)}`
              : `[API Result: ${connectorName}.${operation}] success`;
            optionsRef.current.onSendMessage(resultSummary);
          })
          .catch((err: unknown) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            // eslint-disable-next-line no-console
            console.error(`[ActionDispatch] api action "${action.name}" failed:`, err);
            optionsRef.current.onSendMessage(
              `[API Error: ${connectorName}.${operation}] ${errMsg}`,
            );
          });
        break;
      }

      case 'client': {
        consecutiveRef.current = 0;
        setConsecutiveAutoContinueCount(0);
        const operation = action.name.replace(/^client:/, '');
        const safeContext = sanitizeActionContext(action.context);
        logDebug(operation);
        optionsRef.current.onClientAction?.(operation, safeContext);
        break;
      }
    }
  }, [dispatchAutoContinue]);

  return { handler, resetConsecutiveCount, consecutiveAutoContinueCount };
}
