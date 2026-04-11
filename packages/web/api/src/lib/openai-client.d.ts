/**
 * @module @kickstart/api/lib/openai-client
 *
 * Fetch-based Azure OpenAI client with dual-model support:
 * - Chat model (gpt-5.3-chat) — Chat Completions API for conversation
 * - Codex model (gpt-5.3-codex) — Responses API for code generation
 */
import type { OpenAIToolDefinition, ToolCall } from "@kickstart/core";
export interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    /** Tool calls requested by the assistant (present when finish_reason is "tool_calls"). */
    tool_calls?: ToolCall[];
    /** The ID of the tool call this message is a response to (role: "tool" only). */
    tool_call_id?: string;
}
export interface ChatCompletionOptions {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: {
        type: string;
    };
    /** Override the deployment name (e.g., for inspiration generation). */
    deployment?: string;
    /** Tool definitions in OpenAI function-calling format. */
    tools?: OpenAIToolDefinition[];
}
export interface ChatCompletionResult {
    content: string;
    finishReason: string;
    /** Tool calls requested by the LLM (present when finishReason is "tool_calls"). */
    toolCalls?: ToolCall[];
}
export interface CodexCompletionOptions {
    instructions?: string;
    temperature?: number;
    maxOutputTokens?: number;
}
export interface CodexCompletionResult {
    content: string;
    responseId: string;
    status: string;
}
/** Return the chat deployment name (for UI model indicator). */
export declare function getChatDeploymentName(): string;
/**
 * Return the deployment name to use for inspiration generation.
 * Falls back: AZURE_OPENAI_INSPIRE_DEPLOYMENT → AZURE_OPENAI_CHAT_DEPLOYMENT → AZURE_OPENAI_DEPLOYMENT
 */
export declare function getInspireDeploymentName(): string;
/** Check whether at least one Azure OpenAI model is configured. */
export declare function isConfigured(): boolean;
/**
 * Call Azure OpenAI Chat Completions (non-streaming).
 * Supports function calling via the `tools` option.
 */
export declare function chatCompletion(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<ChatCompletionResult>;
/**
 * Call Azure OpenAI Chat Completions with automatic tool execution.
 *
 * Supports multi-step tool use: if the LLM requests tool calls, executes them
 * via the provided callback, appends results, and calls the LLM again — up to
 * maxToolRounds times — before returning the final text response.
 */
export declare function chatCompletionWithTools(messages: ChatMessage[], options: ChatCompletionOptions, executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>, maxToolRounds?: number): Promise<ChatCompletionResult>;
/**
 * Call Azure OpenAI Chat Completions with streaming (SSE).
 * Yields content deltas as they arrive.
 */
export declare function chatCompletionStream(messages: ChatMessage[], options?: ChatCompletionOptions): AsyncGenerator<string>;
/**
 * Call Azure OpenAI Responses API (non-streaming) for code generation.
 */
export declare function codexCompletion(input: ChatMessage[], options?: CodexCompletionOptions): Promise<CodexCompletionResult>;
/**
 * Call Azure OpenAI Responses API with streaming (SSE) for code generation.
 * Yields content deltas as they arrive via response.output_text.delta events.
 */
export declare function codexCompletionStream(input: ChatMessage[], options?: CodexCompletionOptions): AsyncGenerator<string>;
//# sourceMappingURL=openai-client.d.ts.map