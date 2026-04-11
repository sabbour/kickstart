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
/** Options for the auto-continue wrapper. */
export interface AutoContinueOptions {
    /** Maximum continuation rounds (default: 3). */
    maxContinuations?: number;
    /** The continuation prompt injected as a user message (default below). */
    continuationPrompt?: string;
}
/**
 * Call the LLM with automatic continuation when the response is truncated.
 *
 * If the LLM stops with `finish_reason: "length"`, a follow-up request is
 * sent with a continuation prompt. The content from all rounds is
 * concatenated into a single result.
 *
 * @returns The merged result with `finishReason` from the final round.
 */
export declare function chatCompletionWithAutoContinue(messages: ChatMessage[], options?: ChatCompletionOptions, continueOptions?: AutoContinueOptions): Promise<ChatCompletionResult & {
    continuations: number;
}>;
/**
 * Detect whether a completion result was truncated.
 * Useful for streaming paths where the caller manages continuation manually.
 */
export declare function isTruncated(result: ChatCompletionResult): boolean;
//# sourceMappingURL=auto-continue.d.ts.map