/**
 * @module @kickstart/core/services/response-processor
 *
 * Parses JSON envelope responses from the LLM.
 * The LLM outputs structured JSON with conversational text and A2UI v0.9 messages.
 * No regex. No markdown fences. Just JSON.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A2UI v0.9 message types that can appear in the envelope. */
export type A2UIMessageType =
  | "createSurface"
  | "updateComponents"
  | "updateDataModel"
  | "deleteSurface";

/** A single A2UI v0.9 message. */
export interface A2UIMessage {
  type: A2UIMessageType;
  surfaceId: string;
  [key: string]: unknown;
}

/** An action the frontend should execute. */
export interface Action {
  type: string;
  [key: string]: unknown;
}

/** Result of processing an LLM JSON envelope response. */
export interface ProcessedResponse {
  /** Conversational text to display to the user. */
  message: string;
  /** A2UI v0.9 messages (createSurface, updateComponents, etc.). */
  a2uiMessages: A2UIMessage[];
  /** Actions for the frontend to execute. */
  actions: Action[];
  /** Original JSON string for debugging. */
  raw: string;
}

// ---------------------------------------------------------------------------
// Valid A2UI message types
// ---------------------------------------------------------------------------

const VALID_A2UI_TYPES = new Set<string>([
  "createSurface",
  "updateComponents",
  "updateDataModel",
  "deleteSurface",
]);

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

/**
 * Parse a JSON envelope from LLM output.
 *
 * Expected format:
 * ```json
 * {
 *   "message": "conversational text",
 *   "a2ui": [ ...A2UI v0.9 messages... ],
 *   "actions": [ ...frontend actions... ]
 * }
 * ```
 *
 * Graceful fallbacks:
 * - Invalid JSON → treat entire response as plain text message
 * - Missing `a2ui` → just a text message, no components
 * - Missing `message` → empty text, just components
 * - Malformed A2UI messages → skip bad messages, keep the rest
 */
export function processResponse(jsonString: string): ProcessedResponse {
  const raw = jsonString;

  // Attempt JSON parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    // Not valid JSON — treat the whole thing as plain text
    return { message: jsonString.trim(), a2uiMessages: [], actions: [], raw };
  }

  // Must be a non-array object
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { message: jsonString.trim(), a2uiMessages: [], actions: [], raw };
  }

  const envelope = parsed as Record<string, unknown>;

  // Extract message — string or empty
  const message =
    typeof envelope.message === "string" ? envelope.message : "";

  // Extract and validate A2UI messages
  const a2uiMessages = validateA2UIMessages(envelope.a2ui);

  // Extract and validate actions
  const actions = validateActions(envelope.actions);

  return { message, a2uiMessages, actions, raw };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateA2UIMessages(raw: unknown): A2UIMessage[] {
  if (!Array.isArray(raw)) return [];

  const valid: A2UIMessage[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null || Array.isArray(item))
      continue;
    const msg = item as Record<string, unknown>;

    // Must have valid type and surfaceId
    if (typeof msg.type !== "string" || !VALID_A2UI_TYPES.has(msg.type))
      continue;
    if (typeof msg.surfaceId !== "string" || msg.surfaceId.length === 0)
      continue;

    valid.push(msg as A2UIMessage);
  }

  return valid;
}

function validateActions(raw: unknown): Action[] {
  if (!Array.isArray(raw)) return [];

  const valid: Action[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null || Array.isArray(item))
      continue;
    const action = item as Record<string, unknown>;
    if (typeof action.type !== "string") continue;

    valid.push(action as Action);
  }

  return valid;
}
