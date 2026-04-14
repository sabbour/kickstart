/**
 * @module @kickstart/core/services/response-processor
 *
 * Parses JSON envelope responses from the LLM.
 * The LLM outputs structured JSON with conversational text and A2UI v0.9 messages.
 * No regex. No markdown fences. Just JSON.
 *
 * Validation layers (Issue #153):
 * 1. Payload size / count / depth limits
 * 2. Per-message Zod schema validation (discriminated union on `type`)
 * 3. Per-component Zod schema validation for updateComponents messages
 */

import { logger } from "../telemetry/index.js";
import { interpolateA2UIMessage } from "../engine/data-binding.js";
import {
  A2UIMessageSchema,
  ActionSchema,
  COMPONENT_SCHEMA_REGISTRY,
  KNOWN_COMPONENT_TYPES,
  PAYLOAD_LIMITS,
  checkDepth,
} from "./a2ui-schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A2UI v0.9 message types that can appear in the envelope. */
export type A2UIMessageType =
  | "createSurface"
  | "updateComponents"
  | "updateDataModel"
  | "deleteSurface";

/** A single A2UI v0.9 message (official nested wire format). */
export interface A2UIMessage {
  version: "v0.9";
  createSurface?: { surfaceId: string; catalogId?: string; theme?: Record<string, unknown>; sendDataModel?: boolean };
  updateComponents?: { surfaceId: string; components: unknown[] };
  updateDataModel?: { surfaceId: string; path: string; value: unknown };
  deleteSurface?: { surfaceId: string };
}

/** Determine which message type a nested A2UI message represents. */
function getA2UIMessageType(msg: A2UIMessage): A2UIMessageType | undefined {
  if (msg.createSurface) return "createSurface";
  if (msg.updateComponents) return "updateComponents";
  if (msg.updateDataModel) return "updateDataModel";
  if (msg.deleteSurface) return "deleteSurface";
  return undefined;
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
export function processResponse(
  jsonString: string,
  dataModel?: Record<string, unknown>,
): ProcessedResponse {
  const raw = jsonString;

  // Payload size limit check (byte-accurate, browser-safe)
  const encoder = new TextEncoder();
  const encoded = encoder.encode(jsonString);
  const payloadBytes = encoded.length;
  if (payloadBytes > PAYLOAD_LIMITS.maxPayloadBytes) {
    logger.warn(
      `processResponse: payload size ${payloadBytes} bytes exceeds limit ${PAYLOAD_LIMITS.maxPayloadBytes}, truncating`,
    );
    const decoder = new TextDecoder("utf-8", { fatal: false });
    jsonString = decoder.decode(encoded.subarray(0, PAYLOAD_LIMITS.maxPayloadBytes));
  }

  // Attempt JSON parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    logger.warn("processResponse: not valid JSON, treating as plain text");
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

  // Extract and validate A2UI messages via Zod schemas
  const rawA2UI = validateA2UIMessages(envelope.a2ui);
  // Interpolate data paths in component props when a data model is provided,
  // then re-validate to ensure interpolated values still meet constraints
  const a2uiMessages = dataModel
    ? revalidateAfterInterpolation(
        rawA2UI.map((msg) => interpolateA2UIMessage(msg, dataModel)),
      )
    : rawA2UI;

  // Extract and validate actions
  const actions = validateActions(envelope.actions);

  const result = { message, a2uiMessages, actions, raw };
  logger.track("conversation.turn", {
    messageLength: message.length,
    a2uiMessages: a2uiMessages.length,
    actions: actions.length,
  });
  return result;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateA2UIMessages(raw: unknown): A2UIMessage[] {
  if (!Array.isArray(raw)) return [];

  // Enforce message count limit
  let items = raw;
  if (items.length > PAYLOAD_LIMITS.maxMessages) {
    logger.warn(
      `processResponse: a2ui message count ${items.length} exceeds limit ${PAYLOAD_LIMITS.maxMessages}, truncating`,
    );
    items = items.slice(0, PAYLOAD_LIMITS.maxMessages);
  }

  const valid: A2UIMessage[] = [];
  for (const item of items) {
    // Parse each message against the discriminated union schema
    const result = A2UIMessageSchema.safeParse(item);
    if (!result.success) {
      logger.warn("processResponse: rejected A2UI message", {
        errors: result.error.issues.map((i) => i.message),
        input:
          typeof item === "object" && item !== null
            ? Object.keys(item as Record<string, unknown>).filter(k => k !== "version").join(", ")
            : typeof item,
      });
      continue;
    }

    let msg = result.data as A2UIMessage;
    const msgType = getA2UIMessageType(msg);

    // Per-component validation for updateComponents messages
    if (msgType === "updateComponents") {
      msg = validateComponentsInMessage(msg);
    }

    // Depth check for updateDataModel values
    if (msgType === "updateDataModel") {
      const value = msg.updateDataModel!.value;
      if (!checkDepth(value, PAYLOAD_LIMITS.maxNestingDepth)) {
        logger.warn(
          `processResponse: updateDataModel value exceeds nesting depth limit ${PAYLOAD_LIMITS.maxNestingDepth}, skipping`,
        );
        continue;
      }
    }

    valid.push(msg);
  }

  return valid;
}

/**
 * Validate individual component props within an updateComponents message.
 * Unknown component types are dropped. Known types have props validated
 * against their per-component schema. Invalid components are skipped.
 */
function validateComponentsInMessage(msg: A2UIMessage): A2UIMessage {
  const components = msg.updateComponents?.components;
  if (!Array.isArray(components)) return msg;

  const validated: unknown[] = [];
  for (const comp of components) {
    if (typeof comp !== "object" || comp === null || Array.isArray(comp))
      continue;

    const c = comp as Record<string, unknown>;
    const componentType = c.component;

    if (typeof componentType !== "string") {
      logger.warn(
        "processResponse: component missing 'component' field, skipping",
      );
      continue;
    }

    if (!KNOWN_COMPONENT_TYPES.has(componentType as never)) {
      logger.warn(
        `processResponse: unknown component type "${componentType}", skipping`,
      );
      continue;
    }

    // Look up per-component schema
    const schema = COMPONENT_SCHEMA_REGISTRY[componentType];
    if (schema) {
      const result = schema.safeParse(comp);
      if (!result.success) {
        logger.warn(
          `processResponse: component "${componentType}" failed validation, skipping`,
          {
            errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
          },
        );
        continue;
      }
      validated.push(result.data);
    } else {
      validated.push(comp);
    }
  }

  return {
    ...msg,
    updateComponents: { ...msg.updateComponents!, components: validated },
  };
}

function validateActions(raw: unknown): Action[] {
  if (!Array.isArray(raw)) return [];

  // Enforce actions count limit
  let items = raw;
  if (items.length > PAYLOAD_LIMITS.maxActions) {
    logger.warn(
      `processResponse: actions count ${items.length} exceeds limit ${PAYLOAD_LIMITS.maxActions}, truncating`,
    );
    items = items.slice(0, PAYLOAD_LIMITS.maxActions);
  }

  const valid: Action[] = [];
  for (const item of items) {
    const result = ActionSchema.safeParse(item);
    if (!result.success) continue;
    valid.push(result.data as Action);
  }

  return valid;
}

/**
 * Re-validate A2UI messages after data-model interpolation.
 * Interpolation can introduce values that violate schema limits
 * (e.g. a dataModel string that exceeds maxStringLength), so we
 * re-parse each message through the Zod schemas and drop any that
 * now fail validation.
 */
function revalidateAfterInterpolation(messages: A2UIMessage[]): A2UIMessage[] {
  const valid: A2UIMessage[] = [];
  for (const msg of messages) {
    const result = A2UIMessageSchema.safeParse(msg);
    if (!result.success) {
      logger.warn(
        "processResponse: A2UI message failed re-validation after interpolation",
        {
          errors: result.error.issues.map((i) => i.message),
          type: getA2UIMessageType(msg),
        },
      );
      continue;
    }

    let validated = result.data as A2UIMessage;
    const validatedType = getA2UIMessageType(validated);

    // Re-run per-component validation for updateComponents messages
    if (validatedType === "updateComponents") {
      validated = validateComponentsInMessage(validated);
    }

    // Re-check depth for updateDataModel values
    if (validatedType === "updateDataModel") {
      const value = validated.updateDataModel!.value;
      if (!checkDepth(value, PAYLOAD_LIMITS.maxNestingDepth)) {
        logger.warn(
          "processResponse: updateDataModel value exceeds nesting depth after interpolation, skipping",
        );
        continue;
      }
    }

    valid.push(validated);
  }
  return valid;
}
