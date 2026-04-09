/**
 * @module @kickstart/core/engine/auto-continue
 *
 * Auto-continue middleware for the Kickstart conversation engine.
 *
 * When an A2UI component signals completion via a complete: or continue: prefixed
 * action, the conversation automatically advances without requiring the user to type.
 * This creates a guided flow feel — filling a form or making a selection moves the
 * conversation forward on its own.
 */

/** Action name prefixes that trigger auto-continuation. */
export const AUTO_CONTINUE_PREFIXES = ["complete:", "continue:"] as const;

/** Maximum consecutive auto-continues before requiring explicit user input. */
export const AUTO_CONTINUE_MAX_CONSECUTIVE = 3;

/**
 * Returns true if the action name should trigger auto-continuation.
 * Only complete: and continue: prefixed actions qualify.
 */
export function shouldAutoContinue(actionName: string): boolean {
  return AUTO_CONTINUE_PREFIXES.some((prefix) => actionName.startsWith(prefix));
}

/**
 * Synthesizes a continuation prompt from a complete: or continue: action.
 * The prompt summarizes what the user selected/entered and asks the LLM to
 * continue the conversation.
 */
export function synthesizeContinuationPrompt(action: {
  name: string;
  context?: Record<string, unknown>;
}): string {
  const { name, context } = action;

  // Strip the complete: or continue: prefix
  const cleanName = name.replace(/^(complete:|continue:)/, "");

  // Phase transition embedded in the action name
  if (cleanName.startsWith("navigate:") || cleanName.startsWith("nav:")) {
    const phase = cleanName.replace(/^(navigate:|nav:)/, "");
    return synthesizeNavigationPrompt(phase, context);
  }

  // Build context summary from key-value pairs
  const contextParts: string[] = [];
  if (context && typeof context === "object") {
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined && value !== null && value !== "") {
        contextParts.push(`${key}: ${String(value)}`);
      }
    }
  }

  if (contextParts.length > 0) {
    return `User completed ${cleanName}: ${contextParts.join(", ")}. Please continue.`;
  }

  return `User completed ${cleanName}. Please continue.`;
}

/**
 * Synthesizes a continuation prompt for navigate actions (phase transitions).
 * Used when a navigate: action moves the conversation to the next phase.
 */
export function synthesizeNavigationPrompt(
  phase: string,
  context?: Record<string, unknown>,
): string {
  const contextParts: string[] = [];
  if (context && typeof context === "object") {
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined && value !== null && value !== "") {
        contextParts.push(`${key}: ${String(value)}`);
      }
    }
  }

  if (contextParts.length > 0) {
    return `User is ready to move to ${phase} (${contextParts.join(", ")}). Continue the conversation.`;
  }

  return `User is ready to move to ${phase}. Continue the conversation.`;
}
