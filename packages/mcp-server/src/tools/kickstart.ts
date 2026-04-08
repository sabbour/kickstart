/**
 * @module @kickstart/mcp-server/tools/kickstart
 *
 * Tool handler: Start a new Kickstart conversation.
 * Returns A2UI ConversationPhase component + intro text.
 */

import { randomUUID } from "node:crypto";
import {
  createInitialState,
  Phase,
  getPhaseOrder,
  getPhaseDefinition,
} from "@kickstart/core";
import type { SessionState, ConversationPhaseComponent, PhaseItem } from "@kickstart/core";
import { createA2UIResource } from "../a2ui.js";

/**
 * Start a new Kickstart conversation session.
 *
 * Creates a session, initializes the conversation state machine,
 * and returns an A2UI ConversationPhase UI with welcome text.
 */
export async function handleKickstart(
  sessions: Map<string, SessionState>,
  initialMessage?: string,
): Promise<{ content: Array<{ type: "text"; text: string } | { type: "resource"; resource: { uri: string; mimeType: string; text: string } }> }> {
  const sessionId = randomUUID();
  const now = new Date().toISOString();
  const engineState = createInitialState();

  const session: SessionState = {
    sessionId,
    currentPhase: engineState.currentPhase,
    createdAt: now,
    updatedAt: now,
    appDefinition: {},
    messages: [],
  };

  if (initialMessage) {
    session.messages.push({
      role: "user",
      content: initialMessage,
      timestamp: now,
    });
  }

  sessions.set(sessionId, session);

  // Build A2UI ConversationPhase component
  const phases: PhaseItem[] = getPhaseOrder().map((phase) => ({
    id: phase,
    label: getPhaseDefinition(phase).label,
    status: phase === Phase.Discover ? "active" : "pending",
  }));

  const phaseComponent: ConversationPhaseComponent = {
    type: "ConversationPhase",
    id: "phase-indicator",
    phases,
    currentPhase: Phase.Discover,
  };

  const a2uiResource = createA2UIResource(
    phaseComponent,
    `a2ui://kickstart/session/${sessionId}/phase`,
  );

  const welcomeText = `👋 Welcome to **Kickstart**! I'll help you ship your application to a scalable app platform on Azure.

**Session:** \`${sessionId}\`

Let's start by learning about your app. Tell me:
- What are you building?
- What language or framework does it use?

${initialMessage ? `I see you said: "${initialMessage}" — let me work with that.` : "Just describe your app and we'll go from there!"}`;

  return {
    content: [
      { type: "text", text: welcomeText },
      a2uiResource,
    ],
  };
}
