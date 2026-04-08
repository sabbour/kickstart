/**
 * @module @kickstart/api/lib/openai-client
 *
 * Fetch-based Azure OpenAI client with dual-model support:
 * - Chat model (gpt-5.3-chat) — Chat Completions API for conversation
 * - Codex model (gpt-5.3-codex) — Responses API for code generation
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResult {
  content: string;
  finishReason: string;
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

const CHAT_API_VERSION = "2024-08-01-preview";

/**
 * Call Azure OpenAI Chat Completions (non-streaming).
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<ChatCompletionResult> {
  const { endpoint, chatDeployment, apiKey } = getConfig();
  if (!chatDeployment) {
    throw new Error("No chat deployment configured. Set AZURE_OPENAI_CHAT_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT.");
  }

  const url = `${endpoint}/openai/deployments/${chatDeployment}/chat/completions?api-version=${CHAT_API_VERSION}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure OpenAI Chat error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string }; finish_reason: string }>;
  };

  return {
    content: data.choices[0].message.content,
    finishReason: data.choices[0].finish_reason,
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
  if (!chatDeployment) {
    throw new Error("No chat deployment configured. Set AZURE_OPENAI_CHAT_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT.");
  }

  const url = `${endpoint}/openai/deployments/${chatDeployment}/chat/completions?api-version=${CHAT_API_VERSION}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
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
  if (!codexDeployment) {
    throw new Error("No codex deployment configured. Set AZURE_OPENAI_CODEX_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT.");
  }

  const url = `${endpoint}/openai/deployments/${codexDeployment}/responses?api-version=${RESPONSES_API_VERSION}`;

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
  };

  const textParts = data.output
    .filter((o) => o.type === "message" && o.content)
    .flatMap((o) => o.content!.filter((c) => c.type === "output_text").map((c) => c.text));

  return {
    content: textParts.join(""),
    responseId: data.id,
    status: data.status,
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
  if (!codexDeployment) {
    throw new Error("No codex deployment configured. Set AZURE_OPENAI_CODEX_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT.");
  }

  const url = `${endpoint}/openai/deployments/${codexDeployment}/responses?api-version=${RESPONSES_API_VERSION}`;

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
