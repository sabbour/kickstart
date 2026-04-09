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
