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
import { getPhaseDefinition, getPhaseOrder, processResponse, } from "@kickstart/core";
import { getSession, addMessage } from "../lib/session-store.js";
import { chatCompletion, getChatDeploymentName } from "../lib/openai-client.js";
import { checkRateLimit, rateLimitResponse } from "../lib/rate-limiter.js";
import { safeErrorResponse } from "../lib/error-response.js";
const PREFIX_MAP = [
    ["navigate:", "navigate"],
    ["nav:", "navigate"],
    ["api:", "api"],
];
function categorize(actionName) {
    for (const [prefix, category] of PREFIX_MAP) {
        if (actionName.startsWith(prefix))
            return category;
    }
    return "reply";
}
function stripPrefix(name) {
    return name.replace(/^(navigate:|nav:|api:)/, "");
}
/**
 * Translate an A2UI action into a natural language string for the LLM.
 * Mirrors actionToMessage() in useActionDispatch — keep in sync.
 */
function actionToMessage(action) {
    const cleanName = stripPrefix(action.name);
    const contextParts = [];
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
async function callLLM(sessionId, userMessage, engineState, context) {
    addMessage(sessionId, "user", userMessage);
    const session = getSession(sessionId);
    if (!session)
        throw new Error("Session disappeared during LLM call");
    const messages = session.state.messages.map((m) => ({
        role: m.role,
        content: m.content,
    }));
    // Build phase indicator A2UI message
    const phases = getPhaseOrder().map((phase) => ({
        id: phase,
        label: getPhaseDefinition(phase).label,
        status: session.engineState.phaseStatus[phase] === "active"
            ? "active"
            : session.engineState.phaseStatus[phase] === "complete"
                ? "complete"
                : "pending",
    }));
    const phaseA2ui = [
        {
            type: "createSurface",
            surfaceId: "phase-indicator",
            component: "ConversationPhase",
            phases,
            currentPhase: engineState.currentPhase,
        },
    ];
    const result = await chatCompletion(messages, {
        responseFormat: { type: "json_object" },
    });
    const processed = processResponse(result.content);
    addMessage(sessionId, "assistant", processed.message);
    context.log(`[action] LLM response for session ${sessionId}, phase=${engineState.currentPhase}`);
    return {
        message: processed.message,
        a2uiMessages: [...phaseA2ui, ...processed.a2uiMessages],
        phase: engineState.currentPhase,
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
    handler: async (request, context) => {
        // Rate limit check
        const rateCheck = checkRateLimit(request);
        if (!rateCheck.allowed) {
            return rateLimitResponse(rateCheck.retryAfterMs);
        }
        try {
            // --- Parse & validate request ---
            let body;
            try {
                body = (await request.json());
            }
            catch {
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
            // --- Resolve session ---
            const session = getSession(body.sessionId);
            if (!session) {
                return {
                    status: 404,
                    jsonBody: { error: `Session not found: ${body.sessionId}` },
                };
            }
            const { engineState } = session;
            const category = categorize(body.action.name);
            context.log(`[action] session=${body.sessionId} action="${body.action.name}" category=${category}`);
            // --- Route by action category ---
            if (category === "api") {
                // Stubbed until APIConnector (B-11) ships
                const response = {
                    success: false,
                    status: "not_implemented",
                    message: "API actions require APIConnector (B-11)",
                    phase: engineState.currentPhase,
                };
                return { status: 200, jsonBody: response };
            }
            if (category === "navigate") {
                // Build a navigation-framed message so the LLM understands intent
                const targetPhase = stripPrefix(body.action.name);
                const baseMessage = actionToMessage(body.action);
                const navMessage = `${baseMessage} — User is requesting to navigate to the "${targetPhase}" phase. Please acknowledge and guide them accordingly.`;
                const llmResult = await callLLM(body.sessionId, navMessage, engineState, context);
                const response = {
                    success: true,
                    message: llmResult.message,
                    phase: llmResult.phase,
                    a2uiMessages: llmResult.a2uiMessages,
                    model: llmResult.model,
                };
                return { status: 200, jsonBody: response };
            }
            // Default: reply — translate to message and re-prompt LLM
            const userMessage = actionToMessage(body.action);
            const llmResult = await callLLM(body.sessionId, userMessage, engineState, context);
            const response = {
                success: true,
                message: llmResult.message,
                phase: llmResult.phase,
                a2uiMessages: llmResult.a2uiMessages,
                model: llmResult.model,
            };
            return { status: 200, jsonBody: response };
        }
        catch (err) {
            return safeErrorResponse(err, context, "[action] error");
        }
    },
});
//# sourceMappingURL=action.js.map