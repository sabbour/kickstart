/**
 * @module @kickstart/mcp-server/tools/kickstart
 *
 * Tool handler: Start a new Kickstart conversation.
 * Returns A2UI ConversationPhase component + intro text.
 * Composes the system prompt dynamically based on the current phase.
 */

import { randomUUID } from "node:crypto";
import {
  Phase,
  getPhaseOrder,
  getPhaseDefinition,
  buildSystemPrompt,
  DEPLOYMENT_SAFEGUARDS,
} from "@kickstart/harness";
import type {
  SessionState,
  ConversationPhaseComponent,
  PhaseItem,
} from "@kickstart/harness";
import { createA2UIResource } from "../a2ui.js";
import type { A2UICapability } from "../a2ui.js";

/** MCP tool result content item. */
type ContentItem =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; mimeType: string; text: string } };

/** In-memory session phase state keyed by session ID. */
const sessionPhases = new Map<string, Phase>();

/** Retrieve the current phase for a session. */
export function getSessionPhase(sessionId: string): Phase | undefined {
  return sessionPhases.get(sessionId);
}

/** Store the current phase for a session. */
export function setSessionPhase(sessionId: string, phase: Phase): void {
  sessionPhases.set(sessionId, phase);
}

/** Delete the phase state for a session. */
export function deleteSessionPhase(sessionId: string): void {
  sessionPhases.delete(sessionId);
}

/** No-op stub — v1 engine state was removed in Step 1. */
export function deleteEngineState(_sessionId: string): void {}

function createStubArtifactStore(): NonNullable<SessionState["artifactStore"]> {
  return {
    put(): void {},
  };
}

/**
 * Start a new Kickstart conversation session.
 *
 * Creates a session, initialises the conversation state machine,
 * composes a dynamic system prompt for the Discover phase, and
 * returns an A2UI ConversationPhase UI with welcome text.
 */
export async function handleKickstart(
  sessions: Map<string, SessionState>,
  initialMessage?: string,
  capability: A2UICapability = "kickstart",
): Promise<{ content: ContentItem[] }> {
  const sessionId = randomUUID();
  const now = new Date().toISOString();

  // Persist phase state for future tool calls
  setSessionPhase(sessionId, Phase.Discover);

  const session: SessionState = {
    sessionId,
    currentPhase: Phase.Discover,
    createdAt: now,
    updatedAt: now,
    appDefinition: {},
    messages: [],
    artifactStore: createStubArtifactStore(),
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
    capability,
  );

  const safeguardCount = DEPLOYMENT_SAFEGUARDS.length;

  const welcomeText = `👋 Welcome to **Kickstart**! I'll help you ship your application to a scalable app platform on Azure.

**Session:** \`${sessionId}\`
**Phase:** Discover — tell me about your app
**Safeguards:** ${safeguardCount} deployment best practices will be validated automatically

Let's start by learning about your app. Tell me:
- What are you building?
- What language or framework does it use?

${initialMessage ? `I see you said: "${initialMessage}" — let me work with that.` : "Just describe your app and we'll go from there!"}`;

  const content: ContentItem[] = [{ type: "text", text: welcomeText }];
  if (a2uiResource) content.push(a2uiResource);

  return { content };
}
