/**
 * @module @kickstart/api/functions/action
 *
 * POST /api/action — A2UI action processing endpoint.
 *
 * Receives action events from the frontend (fired by A2UI components),
 * routes them by type, and returns updated state.
 *
 * Action routing:
 * - reply    → Translate action to natural language, re-prompt LLM
 * - navigate → Update phase intent, re-prompt LLM framed as navigation
 * - api      → Stubbed — returns not_implemented until APIConnector (B-11) ships
 *
 * Per decision F17: ALL action types re-prompt the LLM. The LLM stays
 * in full control of state transitions.
 */

import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  getPhaseDefinition,
  getPhaseOrder,
  processResponse,
  isPhase,
  Phase,
} from "@kickstart/core";
import type { PhaseItem } from "@kickstart/core";
import type { A2UIMessage } from "@kickstart/core";
import {
  getSession,
  getPrincipalId,
  hydrateSession,
  addMessage,
  adoptSessionPrincipal,
  isSessionOwnedBy,
} from "../lib/session-store.js";
import type { ClientMessage } from "../lib/session-store.js";
import { chatCompletion, getChatDeploymentName } from "../lib/openai-client.js";
import { checkContentSafety } from "../lib/content-safety.js";
import { checkRateLimit, rateLimitResponse } from "../lib/rate-limiter.js";
import { safeErrorResponse } from "../lib/error-response.js";

const MAX_REHYDRATION_MESSAGES = 50;

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

/** Action object from A2UI — mirrors A2uiClientAction shape. */
interface A2UIAction {
  /** Action name — may carry routing prefix (navigate:, nav:, api:). */
  name: string;
  /** Free-form context payload from the component. */
  context?: Record<string, unknown>;
}

interface ActionRequest {
  sessionId: string;
  action: A2UIAction;
  /** Optional caller-supplied context (current phase, extra state). */
  context?: {
    phase?: string;
    [key: string]: unknown;
  };
  /** Client-side message history for session rehydration after cold starts. */
  messages?: ClientMessage[];
}

interface ActionResponse {
  success: boolean;
  /** Resolved session ID — may differ from the request after rehydration. */
  sessionId?: string;
  /** Human-readable LLM reply (reply / navigate actions). */
  message?: string;
  /** Current phase after processing. */
  phase?: string;
  /** A2UI messages from the LLM response. */
  a2uiMessages?: A2UIMessage[];
  /** Populated for api actions — status info. */
  status?: string;
  /** Model used for the completion (informational). */
  model?: string;
}

// ---------------------------------------------------------------------------
// Routing helpers (mirrors useActionDispatch prefix logic)
// ---------------------------------------------------------------------------

type ActionCategory = "reply" | "navigate" | "api";

const PREFIX_MAP: Array<[string, ActionCategory]> = [
  ["navigate:", "navigate"],
  ["nav:", "navigate"],
  ["api:", "api"],
];

function categorize(actionName: string): ActionCategory {
  for (const [prefix, category] of PREFIX_MAP) {
    if (actionName.startsWith(prefix)) return category;
  }
  return "reply";
}

function stripPrefix(name: string): string {
  return name.replace(/^(navigate:|nav:|api:)/, "");
}

/**
 * Translate an A2UI action into a natural language string for the LLM.
 * Mirrors actionToMessage() in useActionDispatch — keep in sync.
 */
function actionToMessage(action: A2UIAction): string {
  const cleanName = stripPrefix(action.name);

  const contextParts: string[] = [];
  if (action.context && typeof action.context === "object") {
    for (const [key, value] of Object.entries(action.context)) {
      if (value !== undefined && value !== null && value !== "") {
        contextParts.push(`${key}: ${String(value)}`);
      }
    }
  }

  return contextParts.length > 0
    ? `[Action: ${cleanName}] ${contextParts.join(", ")}`
    : `[Action: ${cleanName}]`;
}

// ---------------------------------------------------------------------------
// LLM call helper — shared by reply + navigate
// ---------------------------------------------------------------------------

async function callLLM(
  sessionId: string,
  userMessage: string,
  currentPhase: string,
  context: InvocationContext,
): Promise<{ message: string; a2uiMessages: A2UIMessage[]; phase: string; model: string }> {
  addMessage(sessionId, "user", userMessage);

  const session = getSession(sessionId);
  if (!session) throw new Error("Session disappeared during LLM call");

  const messages = session.state.messages.map((m) => ({
    role: m.role as "system" | "user" | "assistant",
    content: m.content,
  }));

  // Build phase indicator A2UI message
  const order = getPhaseOrder();
  const safePhase: Phase = isPhase(currentPhase) ? currentPhase : Phase.Discover;
  const currentIdx = order.indexOf(safePhase);
  const phases: PhaseItem[] = order.map((phase, idx) => ({
    id: phase,
    label: getPhaseDefinition(phase as Phase).label,
    status: idx < currentIdx
      ? ("complete" as const)
      : idx === currentIdx
        ? ("active" as const)
        : ("pending" as const),
  }));

  const phaseA2ui: A2UIMessage[] = [
    {
      type: "createSurface",
      surfaceId: "phase-indicator",
      component: "ConversationPhase",
      phases,
      currentPhase,
    } as unknown as A2UIMessage,
  ];

  const result = await chatCompletion(messages, {
    responseFormat: { type: "json_object" },
  });

  const processed = processResponse(result.content);
  addMessage(sessionId, "assistant", processed.message);

  context.log(`[action] LLM response for session ${sessionId}, phase=${currentPhase}`);

  return {
    message: processed.message,
    a2uiMessages: [...phaseA2ui, ...processed.a2uiMessages],
    phase: currentPhase,
    model: getChatDeploymentName(),
  };
}

// ---------------------------------------------------------------------------
// Azure Function registration
// ---------------------------------------------------------------------------

app.http("action", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "action",
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
      // --- Parse & validate request ---
      let body: ActionRequest;
      try {
        body = (await request.json()) as ActionRequest;
      } catch {
        return {
          status: 400,
          jsonBody: { error: "Invalid JSON body" },
        };
      }

      if (!body.sessionId?.trim()) {
        return { status: 400, jsonBody: { error: "sessionId is required" } };
      }

      if (!body.action?.name?.trim()) {
        return { status: 400, jsonBody: { error: "action.name is required" } };
      }

      // Hard cap on rehydration history length to prevent abuse.
      if (body.messages && body.messages.length > MAX_REHYDRATION_MESSAGES) {
        return {
          status: 400,
          jsonBody: { error: `messages array exceeds maximum of ${MAX_REHYDRATION_MESSAGES}` },
        };
      }

      // Safety-check ALL client-provided messages in the rehydration history
      // so a safe action payload cannot smuggle unsafe content through replayed history.
      if (body.messages?.length) {
        for (const msg of body.messages) {
          if (!msg.content?.trim()) continue;
          const historySafety = await checkContentSafety(msg.content);
          if (!historySafety.safe) {
            return { status: 400, jsonBody: { error: historySafety.error } };
          }
        }
      }

      // --- Resolve session (hydrate from client history on cold start) ---
      const principalId = getPrincipalId(request);
      let session = getSession(body.sessionId);
      if (session && !isSessionOwnedBy(session, principalId)) {
        return {
          status: 403,
          jsonBody: { error: "Session belongs to a different signed-in user." },
        };
      }
      if (!session) {
        if (body.messages?.length) {
          session = hydrateSession(body.messages, principalId);
        } else {
          return {
            status: 404,
            jsonBody: { error: `Session not found: ${body.sessionId}` },
          };
        }
      }
      adoptSessionPrincipal(session, principalId);

      const { state } = session;
      const sessionId = state.sessionId;
      const currentPhase = state.currentPhase;
      const category = categorize(body.action.name);

      context.log(
        `[action] session=${sessionId} action="${body.action.name}" category=${category}`,
      );

      // --- Route by action category ---

      if (category === "api") {
        // Stubbed until APIConnector (B-11) ships
        const response: ActionResponse = {
          success: false,
          sessionId,
          status: "not_implemented",
          message: "API actions require APIConnector (B-11)",
          phase: currentPhase,
        };
        return { status: 200, jsonBody: response };
      }

      if (category === "navigate") {
        // Build a navigation-framed message so the LLM understands intent
        const targetPhase = stripPrefix(body.action.name);
        const baseMessage = actionToMessage(body.action);
        const navMessage = `${baseMessage} — User is requesting to navigate to the "${targetPhase}" phase. Please acknowledge and guide them accordingly.`;

        const llmResult = await callLLM(
          sessionId,
          navMessage,
          currentPhase,
          context,
        );

        const response: ActionResponse = {
          success: true,
          sessionId,
          message: llmResult.message,
          phase: llmResult.phase,
          a2uiMessages: llmResult.a2uiMessages,
          model: llmResult.model,
        };
        return { status: 200, jsonBody: response };
      }

      // Default: reply — translate to message and re-prompt LLM
      const userMessage = actionToMessage(body.action);
      const llmResult = await callLLM(
        sessionId,
        userMessage,
        currentPhase,
        context,
      );

      const response: ActionResponse = {
        success: true,
        sessionId,
        message: llmResult.message,
        phase: llmResult.phase,
        a2uiMessages: llmResult.a2uiMessages,
        model: llmResult.model,
      };
      return { status: 200, jsonBody: response };
    } catch (err) {
      return safeErrorResponse(err, context, "[action] error");
    }
  },
});
