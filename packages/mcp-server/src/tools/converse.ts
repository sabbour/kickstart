/**
 * @module @kickstart/mcp-server/tools/converse
 *
 * Tool handler: Multi-turn conversation within an existing Kickstart session.
 * Processes user messages through the phase machine, composes the
 * phase-appropriate system prompt, and returns A2UI phase indicators.
 */

import {
  getPhaseOrder,
  getPhaseDefinition,
  buildSystemPrompt,
  Phase,
} from "@kickstart/core";
import type {
  SessionState,
  ConversationPhaseComponent,
  PhaseItem,
} from "@kickstart/core";
import { getEngineState, setEngineState } from "./kickstart.js";
import { createA2UIResource } from "../a2ui.js";
import type { A2UICapability } from "../a2ui.js";

/** MCP tool result content item. */
type ContentItem =
  | { type: "text"; text: string }
  | {
      type: "resource";
      resource: { uri: string; mimeType: string; text: string };
    };

/**
 * Process a user message in an existing conversation session.
 *
 * Records the message, recomposes the system prompt for the current phase,
 * handles phase transitions via the engine state machine, and returns
 * the prompt + phase indicator as A2UI.
 */
export async function handleConverse(
  sessions: Map<string, SessionState>,
  sessionId: string,
  message: string,
  capability: A2UICapability = "kickstart",
): Promise<{ content: ContentItem[] }> {
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
    engineState = { currentPhase: Phase.Discover };
    setEngineState(sessionId, engineState);
  }

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
  const order = getPhaseOrder();
  const currentIdx = order.indexOf(engineState.currentPhase);
  const phases: PhaseItem[] = order.map((phase, idx) => ({
    id: phase,
    label: getPhaseDefinition(phase).label,
    status: idx < currentIdx ? "complete" : idx === currentIdx ? "active" : "pending",
  }));

  const phaseComponent: ConversationPhaseComponent = {
    type: "ConversationPhase",
    id: "phase-indicator",
    phases,
    currentPhase: engineState.currentPhase,
  };

  const a2uiResource = createA2UIResource(
    phaseComponent,
    `a2ui://kickstart/session/${sessionId}/phase`,
    capability,
  );

  const phaseDef = getPhaseDefinition(engineState.currentPhase);

  const responseText = `**Session:** \`${sessionId}\`
**Phase:** ${phaseDef.label}

**System Prompt:**
\`\`\`
${systemPrompt}
\`\`\`

**Your message has been recorded.** Use this system prompt with the LLM to generate a response for the user. The Kickstart engine is in the **${phaseDef.label}** phase.

_Message history contains ${session.messages.length} messages._`;

  const content: ContentItem[] = [{ type: "text", text: responseText }];
  if (a2uiResource) content.push(a2uiResource);

  return { content };
}
