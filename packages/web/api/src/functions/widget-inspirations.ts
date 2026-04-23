/**
 * @module @aks-kickstart/api/functions/widget-inspirations
 *
 * GET /api/inspirations/widgets — Returns widget inspiration ideas for the Playground.
 *
 * If Azure OpenAI is configured, generates AKS operational widget ideas via LLM.
 * Otherwise, returns a rotated fallback idea (avoiding immediate repeats).
 * Supports streaming mode via ?stream=true query parameter.
 *
 * Data and helpers (allow-list, fallbacks, rotation cursors) live in
 * `../lib/widget-inspirations-data.ts` so they can be unit-tested and kept
 * in sync with the client mirror.
 */

import { app } from "@azure/functions";
import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  ALLOWED_A2UI_COMPONENTS,
  nextFocusDomain,
  pickFallbackIdea,
  type WidgetIdea,
} from "../lib/widget-inspirations-data.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALLOWED_LIST = ALLOWED_A2UI_COMPONENTS.join(", ");

/** Unified system prompt shared by both JSON and streaming generation paths. */
const SYSTEM_PROMPT = (focus: string) =>
  `You generate a single creative component idea for an AKS developer tool using only A2UI core components: ${ALLOWED_LIST}.

Do not invent namespaced types (e.g., "aks/PodTable", "Chart", "Container") or suggest workarounds like "use a Table instead of a Chart" — just use the allowed components as-is.

Focus on: ${focus}.

Generate realistic ideas with sample data (pod names, metrics, namespaces) and clear interactions. Keep ideas constructive and appropriate for a professional audience.`;

/** Check whether Azure OpenAI env vars are configured. */
function isOpenAIConfigured(): boolean {
  return !!(
    process.env.AZURE_OPENAI_ENDPOINT &&
    (process.env.KICKSTART_CHAT_MODEL ?? process.env.KICKSTART_CODEX_MODEL) &&
    process.env.AZURE_OPENAI_API_KEY
  );
}

/** Generate widget ideas via Azure OpenAI (JSON mode). */
async function generateWidgetIdeas(): Promise<WidgetIdea[]> {
  const { chatCompletion } = await import("../lib/openai-client.js");

  const focus = nextFocusDomain();

  const result = await chatCompletion(
    [
      {
        role: "system",
        content: SYSTEM_PROMPT(focus),
      },
      {
        role: "user",
        content: `Generate 1 creative component idea focused on: ${focus}. It must one-shot into a complete A2UI component using only the allowed core component types.`,
      },
    ],
    { temperature: 1.0, maxTokens: 300 },
  );

  const parsed = JSON.parse(result.content) as WidgetIdea[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Invalid response format from OpenAI");
  }
  return parsed;
}

/** Generate widget idea prompt via Azure OpenAI (streaming mode — returns raw prompt text). */
async function* generateWidgetPromptStream(): AsyncGenerator<string> {
  const { chatCompletionStream } = await import("../lib/openai-client.js");

  const focus = nextFocusDomain();

  const stream = chatCompletionStream(
    [
      {
        role: "system",
        content: SYSTEM_PROMPT(focus),
      },
      {
        role: "user",
        content: `Generate 1 detailed component idea focused on: ${focus}. It must one-shot into a complete A2UI component using only the allowed core component types.`,
      },
    ],
    { temperature: 1.0, maxTokens: 400 },
  );

  for await (const chunk of stream) {
    yield chunk;
  }
}

/** Simulate streaming by returning a fallback prompt character by character. */
async function* simulateStreaming(text: string): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i++) {
    yield text[i];
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// ---------------------------------------------------------------------------
// Endpoint
// ---------------------------------------------------------------------------

app.http("widget-inspirations", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "inspirations/widgets",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    try {
      const isStreaming = request.query.get("stream") === "true";

      // Streaming mode
      if (isStreaming) {
        if (isOpenAIConfigured()) {
          try {
            // Stream from OpenAI
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              async start(controller) {
                try {
                  for await (const chunk of generateWidgetPromptStream()) {
                    controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                  }
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err);
                  context.log(`Streaming error, falling back: ${msg}`);
                  // Fallback to simulated streaming
                  const fallbackPrompt = pickFallbackIdea().prompt;
                  for await (const char of simulateStreaming(fallbackPrompt)) {
                    controller.enqueue(encoder.encode(`data: ${char}\n\n`));
                  }
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                }
              },
            });

            return {
              status: 200,
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
              },
              body: stream,
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.log(`OpenAI streaming failed, using fallback: ${msg}`);
            // Fallback to simulated streaming
            const fallbackPrompt = pickFallbackIdea().prompt;
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              async start(controller) {
                for await (const char of simulateStreaming(fallbackPrompt)) {
                  controller.enqueue(encoder.encode(`data: ${char}\n\n`));
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              },
            });

            return {
              status: 200,
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
              },
              body: stream,
            };
          }
        } else {
          // No OpenAI — simulate streaming with fallback
          const fallbackPrompt = pickFallbackIdea().prompt;
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              for await (const char of simulateStreaming(fallbackPrompt)) {
                controller.enqueue(encoder.encode(`data: ${char}\n\n`));
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            },
          });

          return {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
            body: stream,
          };
        }
      }

      // Non-streaming mode (JSON response)
      let ideas: WidgetIdea[];

      if (isOpenAIConfigured()) {
        try {
          ideas = await generateWidgetIdeas();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          context.log(`OpenAI generation failed, using fallback: ${msg}`);
          ideas = [pickFallbackIdea()];
        }
      } else {
        ideas = [pickFallbackIdea()];
      }

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        jsonBody: ideas,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      context.log(`Widget inspirations error: ${message}`);
      return { status: 500, jsonBody: { error: message } };
    }
  },
});
