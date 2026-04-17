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
  PHASE_DEFINITIONS,
  processResponse,
  resolveConversationSkills,
  defaultRegistry,
  buildSystemPrompt,
  resolveSkills,
  defaultKitRegistry,
  InMemoryArtifactStore,
} from "@kickstart/core";
import type {
  PhaseItem,
  ToolContext,
  SetupGenerationControlAction,
  SetupGenerationSnapshot,
  ConversationSkillsContext,
} from "@kickstart/core";
import {
  getSession, createSession, getPrincipalId, hydrateSession, addMessage,
  adoptSessionPrincipal, isSessionOwnedBy, recordUsage,
  extractArtifactsFromA2UI, upsertArtifact,
} from "../lib/session-store.js";
import type { ApiSession, ClientMessage, GeneratedArtifact } from "../lib/session-store.js";
import { chatCompletion, chatCompletionWithTools } from "../lib/openai-client.js";
import { checkContentSafety } from "../lib/content-safety.js";
import { checkRateLimit, rateLimitResponse } from "../lib/rate-limiter.js";
import { safeErrorResponse, safeStreamError } from "../lib/error-response.js";
import { chatCompletionWithAutoContinue, isTruncated } from "../lib/auto-continue.js";
import { sanitizeToolOutput } from "../lib/sanitize-tool-output.js";
import { isDebugMode, buildConverseDebugMeta, formatRenderDecisions } from "../lib/debug-mode.js";
import type { DebugMetadata } from "../lib/debug-mode.js";
import { buildTurnUsage, sumChatUsage } from "../lib/usage-tracking.js";
import type { UsageSummary, ChatUsage } from "../lib/usage-tracking.js";
import {
  normalizeConversePhase,
  resolveConverseModelRoute,
} from "../lib/converse-model-router.js";
import type { ConverseModelRoute } from "../lib/converse-model-router.js";
import {
  executeSetupGeneration,
  isSetupGenerationControlAction,
  serializeSetupGenerationEvent,
  shouldUseStepwiseGeneration,
} from "../lib/setup-generation.js";

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
  setupGeneration?: SetupGenerationSnapshot;
  usage?: UsageSummary;
  autoContinue?: boolean;
  autoContinuePrompt?: string;
  debug?: DebugMetadata;
  renderDecisions?: string[];
}

/** SSE "done" event payload sent at the end of a streaming response. */
interface StreamDonePayload {
  sessionId: string;
  phase: string;
  phaseLabel: string;
  model?: string;
  setupGeneration?: SetupGenerationSnapshot;
  usage?: UsageSummary;
  autoContinue?: boolean;
  autoContinuePrompt?: string;
  debug?: DebugMetadata;
  renderDecisions?: string[];
}

function getSafeCurrentPhase(currentPhase: Phase | string): Phase {
  return normalizeConversePhase(currentPhase) ?? Phase.Discover;
}

/** Return the next phase after the given one, or the same phase if already at the end. */
function advancePhase(currentPhase: Phase): Phase {
  const def = PHASE_DEFINITIONS.find((p) => p.id === currentPhase);
  return def?.nextPhase ?? currentPhase;
}

function extractSetupControlAction(
  message: string,
): SetupGenerationControlAction | undefined {
  const normalized = message.trim().toLowerCase();
  if (isSetupGenerationControlAction(normalized)) {
    return normalized;
  }

  if (/retry(?: the)? current step/.test(normalized)) {
    return "retry-current-step";
  }

  if (/stop(?: generation)?/.test(normalized)) {
    return "stop-generation";
  }

  return undefined;
}

function syncSessionPhase(session: ApiSession, nextPhase: Phase): void {
  session.state.currentPhase = nextPhase;
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
      const principalId = getPrincipalId(request);
      let session = body.sessionId
        ? getSession(body.sessionId)
        : undefined;
      if (session && !isSessionOwnedBy(session, principalId)) {
        return { status: 403, jsonBody: { error: "Session belongs to a different signed-in user." } };
      }
      if (!session) {
        session = body.messages?.length
          ? hydrateSession(body.messages, principalId)
          : createSession(principalId);
      }
      adoptSessionPrincipal(session, principalId);

      const { state } = session;

      // Add user message to history
      addMessage(state.sessionId, "user", body.message);

      // Resolve kit skills for the current phase and build a fresh system prompt.
      // This ensures the LLM always has the correct phase-specific capabilities
      // injected, even as the conversation advances through phases.
      const currentPhase = getSafeCurrentPhase(session.state.currentPhase);
      const resolvedSkills = resolveSkills(currentPhase, defaultKitRegistry.getAll());
      const modelRoute = resolveConverseModelRoute(currentPhase, {
        trustedPhase: session.routingPhaseTrusted,
      });
      const wantsStream = request.headers
        .get("accept")
        ?.includes("text/event-stream");
      const debugMode = isDebugMode(request);
      const setupControlAction = extractSetupControlAction(body.message);

      if (shouldUseStepwiseGeneration(session, currentPhase)) {
        const stepwiseModelRoute = resolveConverseModelRoute(currentPhase, {
          trustedPhase: true,
        });
        if (wantsStream) {
          return handleSetupGenerationStreaming(
            session,
            stepwiseModelRoute,
            context,
            debugMode,
            setupControlAction,
          );
        }
        return handleSetupGenerationResponse(
          session,
          stepwiseModelRoute,
          debugMode,
          setupControlAction,
        );
      }


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

      // Per-turn dynamic skill injection (adaptive-ui pattern):
      // Detect the domain of THIS message and inject targeted knowledge +
      // a live session snapshot so the LLM has the right context at the right moment.
      const skillsCtx: ConversationSkillsContext = {
        phase: currentPhase,
        appDefinition: state.appDefinition
          ? {
              runtime: (state.appDefinition as Record<string, unknown>).runtime as string | undefined,
              appType: (state.appDefinition as Record<string, unknown>).appType as string | undefined,
              name: (state.appDefinition as Record<string, unknown>).name as string | undefined,
              databaseType: (state.appDefinition as Record<string, unknown>).databaseType as string | undefined,
              needsIngress: (state.appDefinition as Record<string, unknown>).needsIngress as boolean | undefined,
              resourceTier: (state.appDefinition as Record<string, unknown>).resourceTier as string | undefined,
            }
          : undefined,
        filesGenerated: session.generatedArtifacts.map((a) => a.filename),
      };
      const { domainKnowledge, currentState } = resolveConversationSkills(
        body.message,
        currentPhase,
        skillsCtx,
      );

      // Inject domain knowledge as a one-time user message before the real message.
      // currentState is appended to the last (real) user message.
      if (domainKnowledge) {
        messages.splice(messages.length - 1, 0, {
          role: "user",
          content: domainKnowledge,
        });
      }
      // Append currentState snapshot to the final user message so the LLM always
      // has a live, authoritative snapshot without re-scanning history.
      if (messages.length > 0) {
        const last = messages[messages.length - 1];
        if (last.role === "user") {
          messages[messages.length - 1] = {
            ...last,
            content: `${last.content}\n\n${currentState}`,
          };
        }
      }

      // Create a session-scoped ToolContext for artifact isolation
      const toolContext: ToolContext = {
        artifactStore: new InMemoryArtifactStore(),
      };

      if (wantsStream) {
        return handleStreaming(
          messages, state.sessionId, session, modelRoute, context,
          toolContext, debugMode, session.generatedArtifacts,
        );
      }

      // Non-streaming: call OpenAI with JSON object format + tool support
      const toolDefs = defaultRegistry.toOpenAIFormat();
      const result = await chatCompletionWithTools(
        messages,
        {
          responseFormat: { type: "json_object" },
          tools: toolDefs,
          deployment: modelRoute.deployment,
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
      let turnUsage = result.usage;
      if (isTruncated(result)) {
        const continueMessages: import("../lib/openai-client.js").ChatMessage[] = [
          ...messages,
          { role: "assistant", content: result.content },
        ];
        const continued = await chatCompletionWithAutoContinue(
          continueMessages,
          {
            responseFormat: { type: "json_object" },
            deployment: modelRoute.deployment,
          },
          { continuationPrompt: "Your previous response was cut off mid-JSON. Continue the JSON output exactly where you left off — do not repeat any content." },
        );
        finalContent = result.content + continued.content;
        turnUsage = sumChatUsage(turnUsage, continued.usage);
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
      if (flags.phaseComplete) {
        session.state.currentPhase = advancePhase(session.state.currentPhase);
      }

      // Compute phase indicator AFTER implicit flags so UI and metadata are consistent
      const phaseA2ui = buildPhaseIndicator(session.state.currentPhase);

      addMessage(state.sessionId, "assistant", processed.message);

      const usageSummary = finalizeUsage(state.sessionId, modelRoute, turnUsage);

      const responseBody: ConverseResponse = {
        sessionId: state.sessionId,
        phase: getSafeCurrentPhase(session.state.currentPhase),
        message: processed.message,
        model: modelRoute.model,
        a2ui: [...phaseA2ui, ...processed.a2uiMessages],
        ...(usageSummary ? { usage: usageSummary } : {}),
      };

      // Include auto-continue signal when more files are pending
      if (flags.filesComplete === false) {
        responseBody.autoContinue = true;
        responseBody.autoContinuePrompt = "Generate next set of files";
      }

      // Attach debug metadata when requested
      if (debugMode) {
        const hadExplicitA2UI = processed.a2uiMessages.length > 0;
        const debugMeta = buildConverseDebugMeta(
          modelRoute.model,
          finalContent,
          processed.a2uiMessages.length,
          hadExplicitA2UI,
          session.state.currentPhase,
        );
        responseBody.debug = debugMeta;
        responseBody.renderDecisions = formatRenderDecisions(debugMeta.renderDecisions);
      }

      return { status: 200, jsonBody: responseBody };
    } catch (err) {
      return safeErrorResponse(err, context, "Converse error");
    }
  },
});

/** Build a fresh ConversationPhase A2UI indicator from the current phase. */
function buildPhaseIndicator(currentPhase: Phase): object[] {
  const safePhase = getSafeCurrentPhase(currentPhase);
  const order = getPhaseOrder();
  const currentIdx = order.indexOf(safePhase);
  const phases: PhaseItem[] = order.map((phase, idx) => ({
    id: phase,
    label: getPhaseDefinition(phase).label,
    status: idx < currentIdx
      ? ("complete" as const)
      : idx === currentIdx
        ? ("active" as const)
        : ("pending" as const),
  }));
  return [
    {
      type: "ConversationPhase",
      id: "phase-indicator",
      phases,
      currentPhase: safePhase,
    },
  ];
}

async function handleSetupGenerationResponse(
  session: ApiSession,
  modelRoute: ConverseModelRoute,
  debugMode: boolean,
  controlAction?: SetupGenerationControlAction,
): Promise<HttpResponseInit> {
  const result = await executeSetupGeneration(session, {
    controlAction,
    surfaceId: "generate-progress",
  });

  syncSessionPhase(session, result.currentPhase);
  addMessage(session.state.sessionId, "assistant", result.message);

  const usageSummary = finalizeUsage(
    session.state.sessionId,
    modelRoute,
    result.usage,
  );

  const responseBody: ConverseResponse = {
    sessionId: session.state.sessionId,
    phase: result.currentPhase,
    message: result.message,
    model: modelRoute.model,
    a2ui: [...buildPhaseIndicator(session.state.currentPhase), ...result.a2uiMessages],
    ...(usageSummary ? { usage: usageSummary } : {}),
    setupGeneration: result.snapshot,
  };

  if (debugMode) {
    const debugMeta = buildConverseDebugMeta(
      modelRoute.model,
      result.message,
      result.a2uiMessages.length,
      result.a2uiMessages.length > 0,
      session.state.currentPhase,
    );
    responseBody.debug = debugMeta;
    responseBody.renderDecisions = formatRenderDecisions(debugMeta.renderDecisions);
  }

  return { status: 200, jsonBody: responseBody };
}

function handleSetupGenerationStreaming(
  session: ApiSession,
  modelRoute: ConverseModelRoute,
  context: InvocationContext,
  debugMode: boolean,
  controlAction?: SetupGenerationControlAction,
): HttpResponseInit {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await executeSetupGeneration(session, {
          controlAction,
          surfaceId: "generate-progress",
          hooks: {
            emitEvent: (event) => {
              controller.enqueue(
                encoder.encode(
                  `event: ${event.type}\ndata: ${serializeSetupGenerationEvent(event)}\n\n`,
                ),
              );
            },
          },
        });

        syncSessionPhase(session, result.currentPhase);
        addMessage(session.state.sessionId, "assistant", result.message);

        const usageSummary = finalizeUsage(
          session.state.sessionId,
          modelRoute,
          result.usage,
        );

        controller.enqueue(
          encoder.encode(
            `event: message\ndata: ${JSON.stringify({ content: result.message })}\n\n`,
          ),
        );

        const phaseDef = getPhaseDefinition(result.currentPhase);
        const donePayload: StreamDonePayload = {
          sessionId: session.state.sessionId,
          phase: result.currentPhase,
          phaseLabel: phaseDef.label,
          model: modelRoute.model,
          ...(usageSummary ? { usage: usageSummary } : {}),
          setupGeneration: result.snapshot,
        };

        if (debugMode) {
          const debugMeta = buildConverseDebugMeta(
            modelRoute.model,
            result.message,
            result.a2uiMessages.length,
            result.a2uiMessages.length > 0,
            session.state.currentPhase,
          );
          donePayload.debug = debugMeta;
          donePayload.renderDecisions = formatRenderDecisions(debugMeta.renderDecisions);
        }

        controller.enqueue(
          encoder.encode(`event: done\ndata: ${JSON.stringify(donePayload)}\n\n`),
        );
      } catch (err) {
        const safeMsg = safeStreamError(err, context, "Stream error");
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: safeMsg })}\n\n`),
        );
      } finally {
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

/** Handle SSE streaming response with typed events. */
function handleStreaming(
  messages: import("../lib/openai-client.js").ChatMessage[],
  sessionId: string,
  session: ApiSession,
  modelRoute: ConverseModelRoute,
  context: InvocationContext,
  toolContext: ToolContext,
  debugMode: boolean,
  sessionArtifacts: GeneratedArtifact[],
): HttpResponseInit {
  const encoder = new TextEncoder();
  let accumulatedUsage: ChatUsage | undefined;

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
            deployment: modelRoute.deployment,
          });
          accumulatedUsage = sumChatUsage(accumulatedUsage, probe.usage);

          if (probe.finishReason !== "tool_calls" || !probe.toolCalls?.length) {
            // Auto-continue: if truncated, keep requesting until complete
            let fullContent = probe.content;
            if (isTruncated(probe)) {
              const contMessages = [...workingMessages, { role: "assistant" as const, content: probe.content }];
              const contResult = await chatCompletionWithAutoContinue(
                contMessages,
                {
                  responseFormat: { type: "json_object" },
                  deployment: modelRoute.deployment,
                },
                { continuationPrompt: "Your previous response was cut off mid-JSON. Continue the JSON output exactly where you left off — do not repeat any content." },
              );
              fullContent = probe.content + contResult.content;
              accumulatedUsage = sumChatUsage(accumulatedUsage, contResult.usage);
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
            if (flags.phaseComplete) {
              session.state.currentPhase = advancePhase(session.state.currentPhase);
            }

            addMessage(sessionId, "assistant", processed.message);
            const usageSummary = finalizeUsage(sessionId, modelRoute, accumulatedUsage);

            controller.enqueue(
              encoder.encode(
                `event: message\ndata: ${JSON.stringify({ content: processed.message })}\n\n`,
              ),
            );

            // Compute phase indicator AFTER implicit flags so the SSE
            // response reflects the current phase, not the stale pre-flag one.
            const currentPhaseA2ui = buildPhaseIndicator(session.state.currentPhase);
            const allA2ui = [...currentPhaseA2ui, ...processed.a2uiMessages];
            for (const msg of allA2ui) {
              controller.enqueue(
                encoder.encode(`event: a2ui\ndata: ${JSON.stringify(msg)}\n\n`),
              );
            }

            const currentPhase = getSafeCurrentPhase(session.state.currentPhase);
            const phaseDef = getPhaseDefinition(currentPhase);
            const donePayload: StreamDonePayload = {
              sessionId,
              phase: currentPhase,
              phaseLabel: phaseDef.label,
              model: modelRoute.model,
              ...(usageSummary ? { usage: usageSummary } : {}),
            };

            // Signal auto-continue for file generation
            if (flags.filesComplete === false) {
              donePayload.autoContinue = true;
              donePayload.autoContinuePrompt = "Generate next set of files";
            }

            if (debugMode) {
              const hadExplicitA2UI = processed.a2uiMessages.length > 0;
              const debugMeta = buildConverseDebugMeta(
                modelRoute.model,
                fullContent,
                processed.a2uiMessages.length,
                hadExplicitA2UI,
                session.state.currentPhase,
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

function finalizeUsage(
  sessionId: string,
  modelRoute: ConverseModelRoute,
  usage?: ChatUsage,
): UsageSummary | undefined {
  const turnUsage = buildTurnUsage(modelRoute.model, usage, {
    pricingGroup: modelRoute.pricingGroup,
  });
  if (!turnUsage) return undefined;
  return recordUsage(sessionId, turnUsage);
}

// ---------------------------------------------------------------------------
// Artifact summary — gives the LLM running context of what's been generated
// ---------------------------------------------------------------------------

/**
 * Build a text summary of generated artifacts for injection into the system prompt.
 * Uses pre-extracted metadata — no content re-scanning needed.
 */
function buildArtifactSummary(artifacts: GeneratedArtifact[]): string {
  if (artifacts.length === 0) return "";

  const lines: string[] = [];
  lines.push("Files generated so far: " + artifacts.map((a) => a.filename).join(", "));

  const bicepResources = artifacts.flatMap((a) => a.bicepResources);
  if (bicepResources.length > 0) {
    lines.push("Azure resources declared: " + bicepResources.join(", "));
  }

  const k8sResources = artifacts.flatMap((a) => a.k8sResources);
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

// extractArtifactsFromA2UI, upsertArtifact, inferLanguage, extractArtifactMetadata,
// and MAX_TRACKED_ARTIFACTS are centralized in session-store.ts and imported above.
