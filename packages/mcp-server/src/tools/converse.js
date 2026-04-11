/**
 * @module @kickstart/mcp-server/tools/converse
 *
 * Tool handler: Multi-turn conversation within an existing Kickstart session.
 * Processes user messages through the phase machine, composes the
 * phase-appropriate system prompt, and returns A2UI phase indicators.
 */
import { getPhaseOrder, getPhaseDefinition, buildSystemPrompt, transition, } from "@kickstart/core";
import { getEngineState, setEngineState } from "./kickstart.js";
import { createA2UIResource } from "../a2ui.js";
/**
 * Process a user message in an existing conversation session.
 *
 * Records the message, recomposes the system prompt for the current phase,
 * handles phase transitions via the engine state machine, and returns
 * the prompt + phase indicator as A2UI.
 */
export async function handleConverse(sessions, sessionId, message, capability = "kickstart") {
    const session = sessions.get(sessionId);
    if (!session) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Session \`${sessionId}\` not found. Start a new conversation with the \`kickstart\` tool.`,
                },
            ],
        };
    }
    const now = new Date().toISOString();
    // Record the user message
    session.messages.push({ role: "user", content: message, timestamp: now });
    session.updatedAt = now;
    // Retrieve or recover engine state
    let engineState = getEngineState(sessionId);
    if (!engineState) {
        const { createInitialState } = await import("@kickstart/core");
        engineState = createInitialState();
        setEngineState(sessionId, engineState);
    }
    // Process the message through the phase machine
    engineState = transition(engineState, { type: "USER_INPUT", input: message });
    setEngineState(sessionId, engineState);
    // Recompose system prompt for the (possibly new) current phase
    const systemPrompt = buildSystemPrompt({
        phase: engineState.currentPhase,
        appDefinition: session.appDefinition,
        azureContext: session.azureContext,
        githubContext: session.githubContext,
    });
    // Update session phase to match engine
    session.currentPhase = engineState.currentPhase;
    // Build A2UI phase indicator
    const phases = getPhaseOrder().map((phase) => ({
        id: phase,
        label: getPhaseDefinition(phase).label,
        status: engineState.phaseStatus[phase] === "active"
            ? "active"
            : engineState.phaseStatus[phase] === "complete"
                ? "complete"
                : "pending",
    }));
    const phaseComponent = {
        type: "ConversationPhase",
        id: "phase-indicator",
        phases,
        currentPhase: engineState.currentPhase,
    };
    const a2uiResource = createA2UIResource(phaseComponent, `a2ui://kickstart/session/${sessionId}/phase`, capability);
    const phaseDef = getPhaseDefinition(engineState.currentPhase);
    const responseText = `**Session:** \`${sessionId}\`
**Phase:** ${phaseDef.label}

**System Prompt:**
\`\`\`
${systemPrompt}
\`\`\`

**Your message has been recorded.** Use this system prompt with the LLM to generate a response for the user. The Kickstart engine is in the **${phaseDef.label}** phase.

_Message history contains ${session.messages.length} messages._`;
    const content = [{ type: "text", text: responseText }];
    if (a2uiResource)
        content.push(a2uiResource);
    return { content };
}
//# sourceMappingURL=converse.js.map