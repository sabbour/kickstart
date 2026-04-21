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
        content: `You generate a single creative component idea for a developer tool that helps deploy and operate apps on Azure Kubernetes Service (AKS). The component is rendered with the **A2UI core catalog** and you MUST restrict yourself to its components. Valid component type names (exact spelling): ${ALLOWED_LIST}.

DO NOT invent or reference namespaced component types (e.g. "aks/PodTable", "azure/CostEstimate", "github/RepoPicker", "FactSet", "Chart", "ColumnSet", "Container", "ActionSet", "TextBlock", "ProgressBar", "Input.*"). If you need a chart, describe a Table or Markdown summary instead. If you need a key-value panel, use a DecisionCard or a Column of Row + Text pairs.

Your idea MUST focus on the following area this round: ${focus}.

The prompt you generate should be detailed enough to produce a COMPLETE working component in a single AI response. Specify:
- Which A2UI component types to use (from the allowed list above only)
- What realistic sample data to show (pod names, namespaces, metrics, timestamps, repo names)
- What interactions to include (Buttons, Toggles, ChoicePickers, TextFields)
- How to lay out the component (Row for side-by-side, Column for stacking)

Return ONLY a JSON array with exactly 1 object containing "title" (short catchy name, max 8 words), "subtitle" (one-line description, max 15 words), and "prompt" (a detailed first-person description starting with "I want to build a component that..." specifying the component types, sample data, layout, and interactions). End the prompt with the literal sentence "Use only core A2UI components." No emoji. No markdown. Raw JSON only. All generated ideas must be appropriate for a professional tech audience. Never generate ideas related to weapons, violence, illegal activities, adult content, gambling, or anything harmful or offensive. Keep ideas constructive, inclusive, and suitable for a workplace demo.`,
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
        content: `You generate a single detailed component idea for a developer tool that helps deploy and operate apps on Azure Kubernetes Service (AKS). The component is rendered with the **A2UI core catalog** and you MUST restrict yourself to its components. Valid component type names (exact spelling): ${ALLOWED_LIST}.

DO NOT invent or reference namespaced component types (e.g. "aks/PodTable", "azure/CostEstimate", "github/RepoPicker", "FactSet", "Chart", "ColumnSet", "Container", "ActionSet", "TextBlock", "ProgressBar", "Input.*"). If you need a chart, describe a Table or Markdown summary instead. If you need a key-value panel, use a DecisionCard or a Column of Row + Text pairs.

Your idea MUST focus on the following area this round: ${focus}.

Return ONLY a single first-person prompt starting with "I want to build a component that..." which is detailed enough to produce a complete working A2UI component in one shot. Specify which component types to use (from the allowed list above only), what sample data to show, what interactions to include, and how to lay things out. End the prompt with the literal sentence "Use only core A2UI components." Aim for 60-120 words. No JSON. No markdown. No title. Just the prompt sentence(s). All generated ideas must be appropriate for a professional tech audience. Never generate ideas related to weapons, violence, illegal activities, adult content, gambling, or anything harmful or offensive. Keep ideas constructive, inclusive, and suitable for a workplace demo.`,
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
