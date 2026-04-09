/**
 * @module @kickstart/api/functions/converse
 *
 * POST /api/converse — Main LLM proxy endpoint for the web surface.
 *
 * Accepts a user message, manages session state, calls Azure OpenAI with
 * response_format: json_object, and returns the response as typed SSE events.
 * The LLM outputs a JSON envelope: { message, a2ui, actions }.
 */

import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  getPhaseDefinition,
  getPhaseOrder,
  processResponse,
} from "@kickstart/core";
import type { PhaseItem } from "@kickstart/core";
import { getSession, createSession, addMessage } from "../lib/session-store.js";
import { chatCompletion, chatCompletionStream, getChatDeploymentName } from "../lib/openai-client.js";

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

      const phaseA2ui = [
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
        return handleStreaming(messages, state.sessionId, engineState, phaseA2ui, context);
      }

      // Non-streaming: call OpenAI with JSON object format
      const result = await chatCompletion(messages, {
        responseFormat: { type: "json_object" },
      });

      // Parse the JSON envelope
      const processed = processResponse(result.content);

      addMessage(state.sessionId, "assistant", processed.message);

      const responseBody: ConverseResponse = {
        sessionId: state.sessionId,
        phase: engineState.currentPhase,
        message: processed.message,
        model: getChatDeploymentName(),
        a2ui: [...phaseA2ui, ...processed.a2uiMessages],
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

/** Handle SSE streaming response with typed events. */
function handleStreaming(
  messages: Array<{ role: string; content: string }>,
  sessionId: string,
  engineState: { currentPhase: string },
  phaseA2ui: object[],
  context: InvocationContext,
): HttpResponseInit {
  const encoder = new TextEncoder();
  let fullContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Accumulate the full JSON response from the LLM
        for await (const chunk of chatCompletionStream(
          messages as Array<{ role: "system" | "user" | "assistant"; content: string }>,
          { responseFormat: { type: "json_object" } },
        )) {
          fullContent += chunk;
          // Send raw chunks for progress indication
          controller.enqueue(
            encoder.encode(`event: chunk\ndata: ${JSON.stringify({ content: chunk })}\n\n`),
          );
        }

        // Parse the completed JSON envelope
        const processed = processResponse(fullContent);

        // Store the conversational text
        addMessage(sessionId, "assistant", processed.message);

        // Emit typed SSE events

        // event: message — the conversational text
        controller.enqueue(
          encoder.encode(
            `event: message\ndata: ${JSON.stringify({ content: processed.message })}\n\n`,
          ),
        );

        // event: a2ui — each A2UI message (phase indicator + LLM-generated)
        const allA2ui = [...phaseA2ui, ...processed.a2uiMessages];
        for (const msg of allA2ui) {
          controller.enqueue(
            encoder.encode(
              `event: a2ui\ndata: ${JSON.stringify(msg)}\n\n`,
            ),
          );
        }

        const phaseDef = getPhaseDefinition(engineState.currentPhase as import("@kickstart/core").Phase);

        // event: done — metadata
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({
              sessionId,
              phase: engineState.currentPhase,
              phaseLabel: phaseDef.label,
              model: getChatDeploymentName(),
            })}\n\n`,
          ),
        );

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        context.error(`Stream error: ${msg}`);
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`),
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
