/**
 * @module @kickstart/api/lib/openai-client
 *
 * Fetch-based Azure OpenAI client with dual-deployment support:
 * - Chat deployment (e.g. gpt-5.4-mini) — Chat Completions API for non-coding conversation
 * - Generate deployment (e.g. gpt-5.4) — coding/generate flows
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

import type { OpenAIToolDefinition, ToolCall } from "@kickstart/core";
import { sanitizeToolOutput } from "./sanitize-tool-output.js";
import { normalizeChatUsage, sumChatUsage } from "./usage-tracking.js";
import type { ChatUsage } from "./usage-tracking.js";

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
  responseFormat?: { type: string };
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
  /** Token usage returned by the provider for this completion. */
  usage?: ChatUsage;
}

export interface CodexCompletionOptions {
  instructions?: string;
  temperature?: number;
  maxOutputTokens?: number;
  deployment?: string;
}

export interface CodexCompletionResult {
  content: string;
  responseId: string;
  status: string;
  usage?: ChatUsage;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface OpenAIConfig {
  endpoint: string;
  apiKey: string;
  chatDeployment: string;
  codexDeployment: string;
}

function getConfig(): OpenAIConfig {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const fallback = process.env.AZURE_OPENAI_DEPLOYMENT;

  const chatDeployment =
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ?? fallback;
  const codexDeployment =
    process.env.AZURE_OPENAI_CODEX_DEPLOYMENT ?? fallback;

  if (!endpoint || !apiKey || (!chatDeployment && !codexDeployment)) {
    throw new Error(
      "Missing Azure OpenAI configuration. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and at least one deployment (AZURE_OPENAI_CHAT_DEPLOYMENT, AZURE_OPENAI_CODEX_DEPLOYMENT, or AZURE_OPENAI_DEPLOYMENT as fallback).",
    );
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    apiKey,
    chatDeployment: chatDeployment ?? "",
    codexDeployment: codexDeployment ?? "",
  };
}

/** Return the non-coding chat deployment name (for UI model indicator). */
export function getChatDeploymentName(): string {
  return (
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ??
    process.env.AZURE_OPENAI_DEPLOYMENT ??
    "unknown"
  );
}

/**
 * Return the deployment name to use for inspiration generation.
 * Falls back: AZURE_OPENAI_INSPIRE_DEPLOYMENT → AZURE_OPENAI_CHAT_DEPLOYMENT → AZURE_OPENAI_DEPLOYMENT
 */
export function getInspireDeploymentName(): string {
  return (
    process.env.AZURE_OPENAI_INSPIRE_DEPLOYMENT ??
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ??
    process.env.AZURE_OPENAI_DEPLOYMENT ??
    ""
  );
}

/** Return the coding/generate deployment name used by the app router. */
export function getGenerateDeploymentName(): string {
  return (
    process.env.AZURE_OPENAI_CODEX_DEPLOYMENT ??
    process.env.AZURE_OPENAI_DEPLOYMENT ??
    "unknown"
  );
}

/** Legacy alias for callers that still use codex naming. */
export function getCodexDeploymentName(): string {
  return getGenerateDeploymentName();
}

/** Check whether at least one Azure OpenAI model is configured. */
export function isConfigured(): boolean {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const hasDeployment =
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ??
    process.env.AZURE_OPENAI_CODEX_DEPLOYMENT ??
    process.env.AZURE_OPENAI_DEPLOYMENT;
  return !!(endpoint && apiKey && hasDeployment);
}

// ---------------------------------------------------------------------------
// Chat Completions API (conversation model)
// ---------------------------------------------------------------------------

const CHAT_API_VERSION = "2024-12-01-preview";

/**
 * Call Azure OpenAI Chat Completions (non-streaming).
 * Supports function calling via the `tools` option.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<ChatCompletionResult> {
  const { endpoint, chatDeployment, apiKey } = getConfig();
  const deployment = options.deployment || chatDeployment;
  if (!deployment) {
    throw new Error("No chat deployment configured. Set AZURE_OPENAI_CHAT_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT.");
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${CHAT_API_VERSION}`;

  const body: Record<string, unknown> = {
    messages,
    max_completion_tokens: options.maxTokens ?? 2048,
    stream: false,
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.responseFormat) body.response_format = options.responseFormat;
  if (options.tools?.length) body.tools = options.tools;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure OpenAI Chat error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{
      message: { content: string | null; tool_calls?: ToolCall[] };
      finish_reason: string;
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const choice = data.choices[0];
  return {
    content: choice.message.content ?? "",
    finishReason: choice.finish_reason,
    toolCalls: choice.message.tool_calls,
    usage: normalizeChatUsage(data.usage),
  };
}

/**
 * Call Azure OpenAI Chat Completions with automatic tool execution.
 *
 * Supports multi-step tool use: if the LLM requests tool calls, executes them
 * via the provided callback, appends results, and calls the LLM again — up to
 * maxToolRounds times — before returning the final text response.
 */
export async function chatCompletionWithTools(
  messages: ChatMessage[],
  options: ChatCompletionOptions,
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  maxToolRounds = 5,
): Promise<ChatCompletionResult> {
  const workingMessages: ChatMessage[] = [...messages];
  let accumulatedUsage: ChatUsage | undefined;

  for (let round = 0; round < maxToolRounds; round++) {
    const result = await chatCompletion(workingMessages, options);
    accumulatedUsage = sumChatUsage(accumulatedUsage, result.usage);

    if (result.finishReason !== "tool_calls" || !result.toolCalls?.length) {
      return {
        ...result,
        usage: accumulatedUsage,
      };
    }

    // Append the assistant's tool-call message
    workingMessages.push({
      role: "assistant",
      content: null,
      tool_calls: result.toolCalls,
    });

    // Execute each requested tool and append sanitized results
    for (const toolCall of result.toolCalls) {
      let toolResult: unknown;
      try {
        const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        toolResult = await executeTool(toolCall.function.name, args);
      } catch (err) {
        toolResult = { error: err instanceof Error ? err.message : String(err) };
      }

      workingMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: sanitizeToolOutput(toolResult),
      });
    }
  }

  // Exceeded max rounds — do a final call without tools to get a text response
  const finalResult = await chatCompletion(workingMessages, { ...options, tools: undefined });
  return {
    ...finalResult,
    usage: sumChatUsage(accumulatedUsage, finalResult.usage),
  };
}

/**
 * Call Azure OpenAI Chat Completions with streaming (SSE).
 * Yields content deltas as they arrive.
 */
export async function* chatCompletionStream(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): AsyncGenerator<string> {
  const { endpoint, chatDeployment, apiKey } = getConfig();
  const deployment = options.deployment || chatDeployment;
  if (!deployment) {
    throw new Error("No chat deployment configured. Set AZURE_OPENAI_CHAT_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT.");
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${CHAT_API_VERSION}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      messages,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
      max_completion_tokens: options.maxTokens ?? 2048,
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure OpenAI Chat error (${response.status}): ${text}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        try {
          const parsed = JSON.parse(line.slice(6)) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Responses API (codex model — code generation)
// ---------------------------------------------------------------------------

const RESPONSES_API_VERSION = "2025-03-01-preview";

/**
 * Call Azure OpenAI Responses API (non-streaming) for code generation.
 */
export async function codexCompletion(
  input: ChatMessage[],
  options: CodexCompletionOptions = {},
): Promise<CodexCompletionResult> {
  const { endpoint, codexDeployment, apiKey } = getConfig();
  const deployment = options.deployment || codexDeployment;
  if (!deployment) {
    throw new Error("No codex deployment configured. Set AZURE_OPENAI_CODEX_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT.");
  }

  const url = `${endpoint}/openai/deployments/${deployment}/responses?api-version=${RESPONSES_API_VERSION}`;

  const body: Record<string, unknown> = {
    input: input.filter((m) => m.role !== "system"),
    stream: false,
  };
  if (options.instructions) {
    body.instructions = options.instructions;
  } else {
    const systemMsg = input.find((m) => m.role === "system");
    if (systemMsg) body.instructions = systemMsg.content;
  }
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxOutputTokens !== undefined) body.max_output_tokens = options.maxOutputTokens;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure OpenAI Codex error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    id: string;
    status: string;
    output: Array<{
      type: string;
      content?: Array<{ type: string; text: string }>;
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
  };

  const textParts = data.output
    .filter((o) => o.type === "message" && o.content)
    .flatMap((o) => o.content!.filter((c) => c.type === "output_text").map((c) => c.text));

  return {
    content: textParts.join(""),
    responseId: data.id,
    status: data.status,
    usage: normalizeChatUsage(data.usage),
  };
}

/**
 * Call Azure OpenAI Responses API with streaming (SSE) for code generation.
 * Yields content deltas as they arrive via response.output_text.delta events.
 */
export async function* codexCompletionStream(
  input: ChatMessage[],
  options: CodexCompletionOptions = {},
): AsyncGenerator<string> {
  const { endpoint, codexDeployment, apiKey } = getConfig();
  const deployment = options.deployment || codexDeployment;
  if (!deployment) {
    throw new Error("No codex deployment configured. Set AZURE_OPENAI_CODEX_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT.");
  }

  const url = `${endpoint}/openai/deployments/${deployment}/responses?api-version=${RESPONSES_API_VERSION}`;

  const body: Record<string, unknown> = {
    input: input.filter((m) => m.role !== "system"),
    stream: true,
  };
  if (options.instructions) {
    body.instructions = options.instructions;
  } else {
    const systemMsg = input.find((m) => m.role === "system");
    if (systemMsg) body.instructions = systemMsg.content;
  }
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxOutputTokens !== undefined) body.max_output_tokens = options.maxOutputTokens;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure OpenAI Codex error (${response.status}): ${text}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        try {
          const parsed = JSON.parse(line.slice(6)) as {
            type?: string;
            delta?: string;
          };
          if (parsed.type === "response.output_text.delta" && parsed.delta) {
            yield parsed.delta;
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  }
}
