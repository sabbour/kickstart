/**
 * @module @kickstart/mcp-server/tools/kickstart
 *
 * Tool handler: Start a new Kickstart conversation.
 * Returns A2UI ConversationPhase component + intro text.
 * Composes the system prompt dynamically based on the current phase.
 */
import { randomUUID } from "node:crypto";
import { createInitialState, Phase, getPhaseOrder, getPhaseDefinition, buildSystemPrompt, DEPLOYMENT_SAFEGUARDS, InMemoryArtifactStore, } from "@kickstart/core";
import { createA2UIResource } from "../a2ui.js";
/** In-memory conversation engine state keyed by session ID. */
const engineStates = new Map();
/** Retrieve the engine state for a session. */
export function getEngineState(sessionId) {
    return engineStates.get(sessionId);
}
/** Store engine state for a session. */
export function setEngineState(sessionId, state) {
    engineStates.set(sessionId, state);
}
/** Delete engine state for a session. */
export function deleteEngineState(sessionId) {
    engineStates.delete(sessionId);
}
/**
 * Start a new Kickstart conversation session.
 *
 * Creates a session, initialises the conversation state machine,
 * composes a dynamic system prompt for the Discover phase, and
 * returns an A2UI ConversationPhase UI with welcome text.
 */
export async function handleKickstart(sessions, initialMessage, capability = "kickstart") {
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    const engineState = createInitialState();
    // Persist engine state for future tool calls
    engineStates.set(sessionId, engineState);
    const session = {
        sessionId,
        currentPhase: engineState.currentPhase,
        createdAt: now,
        updatedAt: now,
        appDefinition: {},
        messages: [],
        artifactStore: new InMemoryArtifactStore(),
    };
    if (initialMessage) {
        session.messages.push({
            role: "user",
            content: initialMessage,
            timestamp: now,
        });
    }
    sessions.set(sessionId, session);
    // Compose the system prompt for the current phase
    const systemPrompt = buildSystemPrompt({
        phase: Phase.Discover,
        appDefinition: session.appDefinition,
        azureContext: session.azureContext,
        githubContext: session.githubContext,
    });
    // Store the system prompt as a system message
    session.messages.push({
        role: "system",
        content: systemPrompt,
        timestamp: now,
    });
    // Build A2UI ConversationPhase component
    const phases = getPhaseOrder().map((phase) => ({
        id: phase,
        label: getPhaseDefinition(phase).label,
        status: phase === Phase.Discover ? "active" : "pending",
    }));
    const phaseComponent = {
        type: "ConversationPhase",
        id: "phase-indicator",
        phases,
        currentPhase: Phase.Discover,
    };
    const a2uiResource = createA2UIResource(phaseComponent, `a2ui://kickstart/session/${sessionId}/phase`, capability);
    const safeguardCount = DEPLOYMENT_SAFEGUARDS.length;
    const welcomeText = `👋 Welcome to **Kickstart**! I'll help you ship your application to a scalable app platform on Azure.

**Session:** \`${sessionId}\`
**Phase:** Discover — tell me about your app
**Safeguards:** ${safeguardCount} deployment best practices will be validated automatically

Let's start by learning about your app. Tell me:
- What are you building?
- What language or framework does it use?

${initialMessage ? `I see you said: "${initialMessage}" — let me work with that.` : "Just describe your app and we'll go from there!"}`;
    const content = [{ type: "text", text: welcomeText }];
    if (a2uiResource)
        content.push(a2uiResource);
    return { content };
}
//# sourceMappingURL=kickstart.js.map