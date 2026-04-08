/**
 * @module @kickstart/api/functions/converse
 *
 * POST /api/converse — Main LLM proxy endpoint for the web surface.
 *
 * Accepts a user message, manages session state, calls Azure OpenAI,
 * and returns the response with phase metadata.
 * Supports SSE streaming when Accept: text/event-stream is set.
 */

import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  getPhaseDefinition,
  getPhaseOrder,
} from "@kickstart/core";
import type { PhaseItem } from "@kickstart/core";
import { getSession, createSession, addMessage } from "../lib/session-store.js";
import { chatCompletion, chatCompletionStream, getChatDeploymentName } from "../lib/openai-client.js";
import { processLLMResponse } from "../lib/response-processor.js";

interface ConverseRequest {
  sessionId?: string;
  message: string;
}

interface ConverseResponse {
  sessionId: string;
  phase: string;
  message: string;
  model?: string;
  a2ui?: object[];
  systemPrompt?: string;
}

app.http("converse", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "converse",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as ConverseRequest;

      if (!body.message?.trim()) {
        return { status: 400, jsonBody: { error: "message is required" } };
      }

      // Get or create session
      let session = body.sessionId
        ? getSession(body.sessionId)
        : undefined;
      const isNewSession = !session;
      if (!session) {
        session = createSession();
      }

      const { state, engineState } = session;

      // Add user message to history
      addMessage(state.sessionId, "user", body.message);

      // Build messages array for OpenAI
      const messages = state.messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }));

      // Build A2UI phase indicator
      const phases: PhaseItem[] = getPhaseOrder().map((phase) => ({
        id: phase,
        label: getPhaseDefinition(phase).label,
        status:
          engineState.phaseStatus[phase] === "active"
            ? ("active" as const)
            : engineState.phaseStatus[phase] === "complete"
              ? ("complete" as const)
              : ("pending" as const),
      }));

      const a2ui = [
        {
          type: "ConversationPhase",
          id: "phase-indicator",
          phases,
          currentPhase: engineState.currentPhase,
        },
      ];

      // Check if client wants SSE streaming
      const wantsStream = request.headers
        .get("accept")
        ?.includes("text/event-stream");

      if (wantsStream) {
        return handleStreaming(messages, state.sessionId, engineState, a2ui, context);
      }

      // Non-streaming: call OpenAI and return full response
      const result = await chatCompletion(messages);

      // Post-process: extract A2UI components from response
      const processed = processLLMResponse(
        result.content,
        engineState.currentPhase,
      );

      addMessage(state.sessionId, "assistant", processed.text);

      const phaseDef = getPhaseDefinition(engineState.currentPhase);

      const responseBody: ConverseResponse = {
        sessionId: state.sessionId,
        phase: engineState.currentPhase,
        message: processed.text,
        model: getChatDeploymentName(),
        a2ui: [...a2ui, ...processed.components],
        ...(isNewSession
          ? {
              systemPrompt: state.messages.find((m) => m.role === "system")
                ?.content,
            }
          : {}),
      };

      return { status: 200, jsonBody: responseBody };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      context.error(`Converse error: ${message}`);
      return { status: 500, jsonBody: { error: message } };
    }
  },
});

/** Handle SSE streaming response. */
function handleStreaming(
  messages: Array<{ role: string; content: string }>,
  sessionId: string,
  engineState: { currentPhase: string },
  a2ui: object[],
  context: InvocationContext,
): HttpResponseInit {
  const encoder = new TextEncoder();
  let fullContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of chatCompletionStream(
          messages as Array<{ role: "system" | "user" | "assistant"; content: string }>,
        )) {
          fullContent += chunk;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`),
          );
        }

        // Post-process full response: extract A2UI components
        const processed = processLLMResponse(
          fullContent,
          engineState.currentPhase,
        );

        // Store the clean text (without A2UI markers)
        addMessage(sessionId, "assistant", processed.text);

        const phaseDef = getPhaseDefinition(engineState.currentPhase as import("@kickstart/core").Phase);

        // Final event with metadata + extracted A2UI components
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              done: true,
              sessionId,
              phase: engineState.currentPhase,
              phaseLabel: phaseDef.label,
              model: getChatDeploymentName(),
              cleanText: processed.text,
              a2ui: [...a2ui, ...processed.components],
            })}\n\n`,
          ),
        );

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        context.error(`Stream error: ${msg}`);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
        );
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
}
