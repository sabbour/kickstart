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
  Phase,
  getPhaseDefinition,
  getPhaseOrder,
  processResponse,
  defaultRegistry,
  buildSystemPrompt,
  resolveSkills,
  defaultKitRegistry,
  InMemoryArtifactStore,
} from "@kickstart/core";
import type { PhaseItem, ToolContext } from "@kickstart/core";
import { getSession, createSession, addMessage } from "../lib/session-store.js";
import { chatCompletion, chatCompletionWithTools, getChatDeploymentName } from "../lib/openai-client.js";
import { checkContentSafety } from "../lib/content-safety.js";
import { checkRateLimit, rateLimitResponse } from "../lib/rate-limiter.js";
import { safeErrorResponse, safeStreamError } from "../lib/error-response.js";
import { chatCompletionWithAutoContinue, isTruncated } from "../lib/auto-continue.js";
import { sanitizeToolOutput } from "../lib/sanitize-tool-output.js";
import { isDebugMode, buildConverseDebugMeta, formatRenderDecisions } from "../lib/debug-mode.js";
import type { DebugMetadata } from "../lib/debug-mode.js";

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
}

app.http("converse", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "converse",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    // Rate limit check
    const rateCheck = checkRateLimit(request);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.retryAfterMs!);
    }

    try {
      const body = (await request.json()) as ConverseRequest;

      if (!body.message?.trim()) {
        return { status: 400, jsonBody: { error: "message is required" } };
      }

      // Content safety pre-flight check
      const safetyResult = await checkContentSafety(body.message);
      if (!safetyResult.safe) {
        return { status: 400, jsonBody: { error: safetyResult.error } };
      }

      // Get or create session
      let session = body.sessionId
        ? getSession(body.sessionId)
        : undefined;
      if (!session) {
        session = createSession();
      }

      const { state, engineState } = session;

      // Add user message to history
      addMessage(state.sessionId, "user", body.message);

      // Resolve kit skills for the current phase and build a fresh system prompt.
      // This ensures the LLM always has the correct phase-specific capabilities
      // injected, even as the conversation advances through phases.
      const currentPhase = engineState.currentPhase as Phase;
      const resolvedSkills = resolveSkills(currentPhase, defaultKitRegistry.getAll());
      const freshSystemPrompt = buildSystemPrompt({
        phase: currentPhase,
        appDefinition: state.appDefinition,
        kitPrompts: resolvedSkills.prompts,
      });

      // Build messages array for OpenAI, replacing the stored system prompt
      // with the freshly resolved one (phase + kit skills).
      const messages: import("../lib/openai-client.js").ChatMessage[] = state.messages.map((m, idx) => ({
        role: m.role as "system" | "user" | "assistant",
        content: idx === 0 && m.role === "system" ? freshSystemPrompt : m.content,
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

      // Check if debug metadata is requested
      const debugMode = isDebugMode(request);

      // Create a session-scoped ToolContext for artifact isolation
      const toolContext: ToolContext = {
        artifactStore: new InMemoryArtifactStore(),
      };

      if (wantsStream) {
        return handleStreaming(messages, state.sessionId, engineState, phaseA2ui, context, toolContext, debugMode);
      }

      // Non-streaming: call OpenAI with JSON object format + tool support
      const toolDefs = defaultRegistry.toOpenAIFormat();
      const result = await chatCompletionWithTools(
        messages,
        {
          responseFormat: { type: "json_object" },
          tools: toolDefs,
        },
        async (name, args) => {
          const tool = defaultRegistry.get(name);
          if (!tool) throw new Error(`Unknown tool: ${name}`);
          if (tool.requireApproval) {
            return { error: `Tool "${name}" requires user approval before execution.`, requiresApproval: true };
          }
          return tool.execute(args, toolContext);
        },
      );

      // Auto-continue: if the response was truncated, request continuation
      let finalContent = result.content;
      if (isTruncated(result)) {
        const continueMessages: import("../lib/openai-client.js").ChatMessage[] = [
          ...messages,
          { role: "assistant", content: result.content },
        ];
        const continued = await chatCompletionWithAutoContinue(
          continueMessages,
          { responseFormat: { type: "json_object" } },
          { continuationPrompt: "Your previous response was cut off mid-JSON. Continue the JSON output exactly where you left off — do not repeat any content." },
        );
        finalContent = result.content + continued.content;
      }

      // Parse the JSON envelope
      const processed = processResponse(finalContent);

      addMessage(state.sessionId, "assistant", processed.message);

      const responseBody: ConverseResponse = {
        sessionId: state.sessionId,
        phase: engineState.currentPhase,
        message: processed.message,
        model: getChatDeploymentName(),
        a2ui: [...phaseA2ui, ...processed.a2uiMessages],
      };

      // Attach debug metadata when requested
      if (debugMode) {
        const hadExplicitA2UI = processed.a2uiMessages.length > 0;
        const debugMeta = buildConverseDebugMeta(
          getChatDeploymentName(),
          finalContent,
          processed.a2uiMessages.length,
          hadExplicitA2UI,
          engineState.currentPhase,
        );
        (responseBody as unknown as Record<string, unknown>).debug = debugMeta;
        (responseBody as unknown as Record<string, unknown>).renderDecisions =
          formatRenderDecisions(debugMeta.renderDecisions);
      }

      return { status: 200, jsonBody: responseBody };
    } catch (err) {
      return safeErrorResponse(err, context, "Converse error");
    }
  },
});

/** Handle SSE streaming response with typed events. */
function handleStreaming(
  messages: import("../lib/openai-client.js").ChatMessage[],
  sessionId: string,
  engineState: { currentPhase: string },
  phaseA2ui: object[],
  context: InvocationContext,
  toolContext: ToolContext,
  debugMode: boolean,
): HttpResponseInit {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Resolve any tool calls first (non-streaming rounds), then stream final response
        const toolDefs = defaultRegistry.toOpenAIFormat();
        let workingMessages = [...messages];
        let toolRoundsComplete = false;

        // Run tool resolution rounds (non-streaming)
        for (let round = 0; round < 5 && !toolRoundsComplete; round++) {
          const probe = await chatCompletion(workingMessages, {
            responseFormat: { type: "json_object" },
            tools: toolDefs,
          });

          if (probe.finishReason !== "tool_calls" || !probe.toolCalls?.length) {
            // Auto-continue: if truncated, keep requesting until complete
            let fullContent = probe.content;
            if (isTruncated(probe)) {
              const contMessages = [...workingMessages, { role: "assistant" as const, content: probe.content }];
              const contResult = await chatCompletionWithAutoContinue(
                contMessages,
                { responseFormat: { type: "json_object" } },
                { continuationPrompt: "Your previous response was cut off mid-JSON. Continue the JSON output exactly where you left off — do not repeat any content." },
              );
              fullContent = probe.content + contResult.content;
            }

            // No more tool calls — stream the final content
            const chunks = fullContent.match(/.{1,50}/g) ?? [fullContent];
            for (const chunk of chunks) {
              controller.enqueue(
                encoder.encode(`event: chunk\ndata: ${JSON.stringify({ content: chunk })}\n\n`),
              );
            }

            const processed = processResponse(fullContent);
            addMessage(sessionId, "assistant", processed.message);

            controller.enqueue(
              encoder.encode(
                `event: message\ndata: ${JSON.stringify({ content: processed.message })}\n\n`,
              ),
            );

            const allA2ui = [...phaseA2ui, ...processed.a2uiMessages];
            for (const msg of allA2ui) {
              controller.enqueue(
                encoder.encode(`event: a2ui\ndata: ${JSON.stringify(msg)}\n\n`),
              );
            }

            const phaseDef = getPhaseDefinition(engineState.currentPhase as import("@kickstart/core").Phase);
            const donePayload: Record<string, unknown> = {
              sessionId,
              phase: engineState.currentPhase,
              phaseLabel: phaseDef.label,
              model: getChatDeploymentName(),
            };

            if (debugMode) {
              const hadExplicitA2UI = processed.a2uiMessages.length > 0;
              const debugMeta = buildConverseDebugMeta(
                getChatDeploymentName(),
                fullContent,
                processed.a2uiMessages.length,
                hadExplicitA2UI,
                engineState.currentPhase,
              );
              donePayload.debug = debugMeta;
              donePayload.renderDecisions = formatRenderDecisions(debugMeta.renderDecisions);
            }

            controller.enqueue(
              encoder.encode(
                `event: done\ndata: ${JSON.stringify(donePayload)}\n\n`,
              ),
            );

            toolRoundsComplete = true;
            break;
          }

          // Emit tool execution status to client
          for (const tc of probe.toolCalls) {
            controller.enqueue(
              encoder.encode(
                `event: tool_call\ndata: ${JSON.stringify({ name: tc.function.name })}\n\n`,
              ),
            );
          }

          // Append assistant tool-call message
          workingMessages.push({
            role: "assistant",
            content: null,
            tool_calls: probe.toolCalls,
          });

          // Execute tools and append sanitized results
          for (const tc of probe.toolCalls) {
            let toolResult: unknown;
            try {
              const tool = defaultRegistry.get(tc.function.name);
              if (!tool) throw new Error(`Unknown tool: ${tc.function.name}`);
              if (tool.requireApproval) {
                toolResult = { error: `Tool "${tc.function.name}" requires user approval before execution.`, requiresApproval: true };
              } else {
                const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
                toolResult = await tool.execute(args, toolContext);
              }
            } catch (err) {
              toolResult = { error: err instanceof Error ? err.message : String(err) };
            }

            const sanitized = sanitizeToolOutput(toolResult);

            controller.enqueue(
              encoder.encode(
                `event: tool_result\ndata: ${JSON.stringify({ name: tc.function.name, result: sanitized })}\n\n`,
              ),
            );

            workingMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: sanitized,
            });
          }
        }

        controller.close();
      } catch (err) {
        const safeMsg = safeStreamError(err, context, "Stream error");
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: safeMsg })}\n\n`),
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
