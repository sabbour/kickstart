/**
 * @module @kickstart/api/functions/converse
 *
 * POST /api/converse — Main LLM proxy endpoint for the web surface.
 *
 * Accepts a user message, manages session state, calls Azure OpenAI with
 * response_format: json_object, and returns the response as typed SSE events.
 * The LLM outputs a JSON envelope: { message, a2ui, actions, phaseComplete, filesComplete }.
 *
 * Artifact summary injection: every turn, the harness scans previously generated
 * FileEditor components and appends a summary to the system prompt so the LLM
 * has running context of what files/resources exist.
 *
 * Implicit state flags: the LLM can signal phaseComplete (advance phase) and
 * filesComplete (auto-continue file generation) without explicit user action.
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
  handleImplicitFlags,
} from "@kickstart/core";
import type { PhaseItem, ToolContext, ConversationState } from "@kickstart/core";
import { getSession, createSession, hydrateSession, addMessage } from "../lib/session-store.js";
import type { ClientMessage, GeneratedArtifact } from "../lib/session-store.js";
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
  /** Client-side message history for session rehydration after cold starts. */
  messages?: ClientMessage[];
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

      // Content safety pre-flight check on the current message
      const safetyResult = await checkContentSafety(body.message);
      if (!safetyResult.safe) {
        return { status: 400, jsonBody: { error: safetyResult.error } };
      }

      // Hard cap on rehydration history length to prevent abuse.
      const MAX_REHYDRATION_MESSAGES = 50;
      if (body.messages && body.messages.length > MAX_REHYDRATION_MESSAGES) {
        return {
          status: 400,
          jsonBody: { error: `messages array exceeds maximum of ${MAX_REHYDRATION_MESSAGES}` },
        };
      }

      // Safety-check ALL client-provided messages in the rehydration history
      // (both user and assistant roles) — without this, a client could send a
      // safe `message` but smuggle unsafe content through `body.messages`.
      if (body.messages?.length) {
        for (const msg of body.messages) {
          if (!msg.content?.trim()) continue;
          const historySafety = await checkContentSafety(msg.content);
          if (!historySafety.safe) {
            return { status: 400, jsonBody: { error: historySafety.error } };
          }
        }
      }

      // Get or create session — if the in-memory session is gone but the
      // client sent its message history, hydrate a new session from it so
      // the LLM retains full conversational context across cold starts.
      let session = body.sessionId
        ? getSession(body.sessionId)
        : undefined;
      if (!session) {
        session = body.messages?.length
          ? hydrateSession(body.messages)
          : createSession();
      }

      const { state, engineState } = session;

      // Add user message to history
      addMessage(state.sessionId, "user", body.message);

      // Resolve kit skills for the current phase and build a fresh system prompt.
      // This ensures the LLM always has the correct phase-specific capabilities
      // injected, even as the conversation advances through phases.
      const currentPhase = engineState.currentPhase as Phase;
      const resolvedSkills = resolveSkills(currentPhase, defaultKitRegistry.getAll());


      // Build artifact summary from files generated in previous turns
      const artifactSummary = buildArtifactSummary(session.generatedArtifacts);

      const freshSystemPrompt = buildSystemPrompt({
        phase: currentPhase,
        appDefinition: state.appDefinition,
        kitPrompts: resolvedSkills.prompts,
        artifactSummary: artifactSummary || undefined,
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
        return handleStreaming(
          messages, state.sessionId, engineState, phaseA2ui, context,
          toolContext, debugMode, session.generatedArtifacts,
          (newState) => { session.engineState = newState; },
        );
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

      // Extract generated artifacts from FileEditor components and track them
      const newArtifacts = extractArtifactsFromA2UI(processed.a2uiMessages);
      for (const art of newArtifacts) {
        upsertArtifact(session.generatedArtifacts, art);
      }

      // Handle implicit state flags from LLM response
      const flags = extractImplicitFlags(finalContent);
      if (flags.phaseComplete || flags.filesComplete !== null) {
        session.engineState = handleImplicitFlags(session.engineState, flags);
      }

      addMessage(state.sessionId, "assistant", processed.message);

      const responseBody: ConverseResponse = {
        sessionId: state.sessionId,
        phase: session.engineState.currentPhase,
        message: processed.message,
        model: getChatDeploymentName(),
        a2ui: [...phaseA2ui, ...processed.a2uiMessages],
      };

      // Include auto-continue signal when more files are pending
      if (flags.filesComplete === false) {
        (responseBody as unknown as Record<string, unknown>).autoContinue = true;
        (responseBody as unknown as Record<string, unknown>).autoContinuePrompt = "Generate next set of files";
      }

      // Attach debug metadata when requested
      if (debugMode) {
        const hadExplicitA2UI = processed.a2uiMessages.length > 0;
        const debugMeta = buildConverseDebugMeta(
          getChatDeploymentName(),
          finalContent,
          processed.a2uiMessages.length,
          hadExplicitA2UI,
          session.engineState.currentPhase,
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
  initialEngineState: { currentPhase: string },
  phaseA2ui: object[],
  context: InvocationContext,
  toolContext: ToolContext,
  debugMode: boolean,
  sessionArtifacts: GeneratedArtifact[],
  updateEngineState: (newState: ConversationState) => void,
): HttpResponseInit {
  const encoder = new TextEncoder();
  let engineState = initialEngineState;

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

            // Track generated artifacts from this turn
            const newArtifacts = extractArtifactsFromA2UI(processed.a2uiMessages);
            for (const art of newArtifacts) {
              upsertArtifact(sessionArtifacts, art);
            }

            // Handle implicit state flags
            const flags = extractImplicitFlags(fullContent);
            if (flags.phaseComplete || flags.filesComplete !== null) {
              const updated = handleImplicitFlags(
                engineState as ConversationState,
                flags,
              );
              updateEngineState(updated);
              engineState = { currentPhase: updated.currentPhase };
            }

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

            // Signal auto-continue for file generation
            if (flags.filesComplete === false) {
              donePayload.autoContinue = true;
              donePayload.autoContinuePrompt = "Generate next set of files";
            }

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

// ---------------------------------------------------------------------------
// Artifact summary — gives the LLM running context of what's been generated
// ---------------------------------------------------------------------------

/**
 * Build a text summary of generated artifacts for injection into the system prompt.
 * Modeled after Try-AKS's buildArtifactSummary pattern.
 */
function buildArtifactSummary(artifacts: GeneratedArtifact[]): string {
  if (artifacts.length === 0) return "";

  const lines: string[] = [];
  lines.push("Files generated so far: " + artifacts.map((a) => a.filename).join(", "));

  // Extract Bicep resources
  const bicepResources: string[] = [];
  for (const a of artifacts) {
    if (!a.filename.endsWith(".bicep")) continue;
    const re = /resource\s+(\w+)\s+'(Microsoft\.[^'@]+)@/g;
    let m;
    while ((m = re.exec(a.content)) !== null) {
      bicepResources.push(`${m[1]} (${m[2]})`);
    }
  }
  if (bicepResources.length > 0) {
    lines.push("Azure resources declared: " + bicepResources.join(", "));
  }

  // Extract K8s resources
  const k8sResources: string[] = [];
  for (const a of artifacts) {
    if (!(a.filename.endsWith(".yaml") || a.filename.endsWith(".yml"))) continue;
    const docs = a.content.split(/^---$/m);
    for (const doc of docs) {
      const kindMatch = doc.match(/kind:\s*(\w+)/);
      const nameMatch = doc.match(/name:\s*["']?([a-z0-9][-a-z0-9]*)["']?/m);
      if (kindMatch) {
        k8sResources.push(kindMatch[1] + (nameMatch ? ": " + nameMatch[1] : ""));
      }
    }
  }
  if (k8sResources.length > 0) {
    lines.push("Kubernetes resources declared: " + k8sResources.join(", "));
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Implicit state flags — parsed from LLM JSON response
// ---------------------------------------------------------------------------

interface ParsedImplicitFlags {
  phaseComplete: boolean;
  filesComplete: boolean | null;
}

/** Extract phaseComplete/filesComplete from the raw LLM JSON envelope. */
function extractImplicitFlags(rawJson: string): ParsedImplicitFlags {
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    return {
      phaseComplete: parsed.phaseComplete === true,
      filesComplete: typeof parsed.filesComplete === "boolean" ? parsed.filesComplete : null,
    };
  } catch {
    return { phaseComplete: false, filesComplete: null };
  }
}

// ---------------------------------------------------------------------------
// Artifact extraction from A2UI messages
// ---------------------------------------------------------------------------

/** Extract FileEditor filenames and content from A2UI updateComponents messages. */
function extractArtifactsFromA2UI(
  a2uiMessages: Array<{ updateComponents?: { components: unknown[] } }>,
): GeneratedArtifact[] {
  const artifacts: GeneratedArtifact[] = [];
  for (const msg of a2uiMessages) {
    if (!msg.updateComponents?.components) continue;
    for (const comp of msg.updateComponents.components) {
      const c = comp as Record<string, unknown>;
      if (
        c.component === "FileEditor" &&
        typeof c.filename === "string" &&
        typeof c.content === "string"
      ) {
        artifacts.push({ filename: c.filename, content: c.content });
      }
    }
  }
  return artifacts;
}

/** Upsert an artifact into the list — replace if same filename exists. */
function upsertArtifact(list: GeneratedArtifact[], artifact: GeneratedArtifact): void {
  const idx = list.findIndex((a) => a.filename === artifact.filename);
  if (idx >= 0) {
    list[idx] = artifact;
  } else {
    list.push(artifact);
  }
}
