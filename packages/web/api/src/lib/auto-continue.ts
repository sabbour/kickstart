/**
 * @module @kickstart/api/lib/auto-continue
 *
 * Middleware that detects when an LLM response was truncated (finish_reason:
 * "length") and automatically sends continuation requests until the response
 * is complete or a maximum number of rounds is reached.
 *
 * Works with both plain chat completions and JSON-mode completions.
 */

import type { ChatMessage, ChatCompletionResult, ChatCompletionOptions } from "./openai-client.js";
import { chatCompletion } from "./openai-client.js";

/** Options for the auto-continue wrapper. */
export interface AutoContinueOptions {
  /** Maximum continuation rounds (default: 3). */
  maxContinuations?: number;
  /** The continuation prompt injected as a user message (default below). */
  continuationPrompt?: string;
}

const DEFAULT_MAX_CONTINUATIONS = 3;
const DEFAULT_CONTINUATION_PROMPT =
  "Your previous response was cut off. Continue exactly where you left off — do not repeat any content.";

/**
 * Call the LLM with automatic continuation when the response is truncated.
 *
 * If the LLM stops with `finish_reason: "length"`, a follow-up request is
 * sent with a continuation prompt. The content from all rounds is
 * concatenated into a single result.
 *
 * @returns The merged result with `finishReason` from the final round.
 */
export async function chatCompletionWithAutoContinue(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
  continueOptions: AutoContinueOptions = {},
): Promise<ChatCompletionResult & { continuations: number }> {
  const maxRounds = continueOptions.maxContinuations ?? DEFAULT_MAX_CONTINUATIONS;
  const prompt = continueOptions.continuationPrompt ?? DEFAULT_CONTINUATION_PROMPT;

  const workingMessages = [...messages];
  let accumulated = "";
  let lastResult: ChatCompletionResult;
  let continuations = 0;

  for (let round = 0; round < maxRounds; round++) {
    lastResult = await chatCompletion(workingMessages, options);
    accumulated += lastResult.content;

    if (lastResult.finishReason !== "length") {
      return {
        content: accumulated,
        finishReason: lastResult.finishReason,
        continuations,
      };
    }

    // Truncated — prepare continuation
    continuations++;
    workingMessages.push({ role: "assistant", content: lastResult.content });
    workingMessages.push({ role: "user", content: prompt });
  }

  // Exceeded max continuations — return what we have
  return {
    content: accumulated,
    finishReason: "length",
    continuations,
  };
}

/**
 * Detect whether a completion result was truncated.
 * Useful for streaming paths where the caller manages continuation manually.
 */
export function isTruncated(result: ChatCompletionResult): boolean {
  return result.finishReason === "length";
}
