/**
 * @module @kickstart/core/services
 *
 * Service-layer utilities for processing LLM responses.
 */

export { processResponse } from "./response-processor.js";

export type {
  ProcessedResponse,
  A2UIMessage,
  A2UIMessageType,
  Action,
} from "./response-processor.js";

export {
  PAYLOAD_LIMITS,
  KNOWN_COMPONENT_TYPES,
  COMPONENT_SCHEMA_REGISTRY,
  A2UIMessageSchema,
  ActionSchema,
  checkDepth,
} from "./a2ui-schema.js";

export type { KnownComponentType } from "./a2ui-schema.js";
