/**
 * @module @aks-kickstart/mcp-server/tools/action
 *
 * Tool handler: Process user actions from the A2UI interface.
 * Handles phase advancement, resource selection, and form submissions.
 */

import {
  getPhaseDefinition,
  getPhaseOrder,
  PHASE_DEFINITIONS,
  Phase,
  advancePhase,
} from "@aks-kickstart/harness";
import type {
  SessionState,
  PhaseItem,
} from "@aks-kickstart/harness";
import { createA2UIResource } from "../a2ui.js";

type ActionType = "advance" | "skip" | "select" | "submit" | "reply" | "navigate" | "api";

/** Local structural type for the ConversationPhase A2UI component. */
interface ConversationPhaseComponent {
  type: "ConversationPhase";
  id: string;
  phases: PhaseItem[];
  currentPhase: Phase;
  [key: string]: unknown;
}

/**
 * Handle a user action from the A2UI interface.
 *
 * Dispatches to the conversation state machine and returns
 * updated A2UI components reflecting the new state.
 */
export async function handleAction(
  sessions: Map<string, SessionState>,
  sessionId: string,
  actionType: ActionType,
  payload?: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string } | { type: "resource"; resource: { uri: string; mimeType: string; text: string } }> }> {
  const session = sessions.get(sessionId);
  if (!session) {
    return {
      content: [{ type: "text", text: `Error: Session \`${sessionId}\` not found.` }],
    };
  }

  const phaseOrder = getPhaseOrder();
  const isKnownPhase = (value: string): value is Phase =>
    phaseOrder.includes(value as Phase);

  // Normalize persisted phase before using it.
  let currentPhase: Phase = isKnownPhase(session.currentPhase)
    ? session.currentPhase
    : Phase.Discover;

  // Helper: compute phase indicator items from current phase
  function buildPhaseItems(): PhaseItem[] {
    const currentIdx = phaseOrder.indexOf(currentPhase);
    return phaseOrder.map((phase, idx) => ({
      id: phase,
      label: getPhaseDefinition(phase).label,
      status: idx < currentIdx ? "complete" : idx === currentIdx ? "active" : "pending",
    }));
  }

  // Process action
  switch (actionType) {
    case "advance":
      currentPhase = advancePhase(currentPhase);
      break;

    case "skip":
      currentPhase = advancePhase(currentPhase);
      break;

    case "select":
      if (payload) {
        Object.assign(session.appDefinition, payload);
      }
      break;

    case "submit":
      if (payload) {
        Object.assign(session.appDefinition, payload);
      }
      currentPhase = advancePhase(currentPhase);
      break;

    case "reply": {
      const message = payload?.message;
      if (!message || typeof message !== "string" || message.trim() === "") {
        session.updatedAt = new Date().toISOString();
        sessions.set(sessionId, session);
        return {
          content: [{ type: "text", text: "Error: Missing required field: `message` is required for reply actions." }],
        };
      }
      session.messages = session.messages ?? [];
      session.messages.push({
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      });
      session.currentPhase = currentPhase;
      session.updatedAt = new Date().toISOString();
      sessions.set(sessionId, session);
      const replyDef = getPhaseDefinition(currentPhase);
      return {
        content: [{ type: "text", text: `Received reply in **${replyDef.label}** phase. The conversation will continue from here.` }],
      };
    }

    case "navigate": {
      const targetPhase = payload?.targetPhase;
      if (!targetPhase) {
        session.currentPhase = currentPhase;
        session.updatedAt = new Date().toISOString();
        sessions.set(sessionId, session);
        return {
          content: [{ type: "text", text: "Error: Missing required field: `targetPhase` is required for navigate actions." }],
        };
      }
      if (!isKnownPhase(targetPhase as string)) {
        session.currentPhase = currentPhase;
        session.updatedAt = new Date().toISOString();
        sessions.set(sessionId, session);
        return {
          content: [{ type: "text", text: `Error: Invalid phase: \`${targetPhase}\` is not a recognized phase.` }],
        };
      }
      // Direct phase assignment — navigation can go forward or backward
      session.currentPhase = targetPhase as string;
      session.updatedAt = new Date().toISOString();
      sessions.set(sessionId, session);

      // Build phase indicator for the new current phase
      const navPhase = targetPhase as Phase;
      const navIdx = phaseOrder.indexOf(navPhase);
      const navPhaseItems: PhaseItem[] = phaseOrder.map((phase, idx) => ({
        id: phase,
        label: getPhaseDefinition(phase).label,
        status: idx < navIdx ? "complete" : idx === navIdx ? "active" : "pending",
      }));
      const navPhaseComponent: ConversationPhaseComponent = {
        type: "ConversationPhase",
        id: "phase-indicator",
        phases: navPhaseItems,
        currentPhase: navPhase,
      };
      const navResource = createA2UIResource(
        navPhaseComponent,
        `a2ui://kickstart/session/${sessionId}/phase`,
      );
      const navDef = getPhaseDefinition(navPhase);
      const navContent: Array<{ type: "text"; text: string } | { type: "resource"; resource: { uri: string; mimeType: string; text: string } }> = [
        { type: "text", text: `Navigated to **${navDef.label}** phase: ${navDef.description}` },
      ];
      if (navResource) navContent.push(navResource);
      return { content: navContent };
    }

    case "api": {
      session.updatedAt = new Date().toISOString();
      sessions.set(sessionId, session);
      return {
        content: [{ type: "text", text: "API actions are not yet implemented -- stub acknowledged. This action will be connected to the ServiceConnector in a future iteration." }],
      };
    }

    default: {
      // Unknown action type — return error, do not mutate state
      return {
        content: [{ type: "text", text: `Error: Unknown action type: \`${actionType}\`. Valid types are: advance, skip, select, submit, reply, navigate, api.` }],
      };
    }
  }

  // Update session
  session.currentPhase = currentPhase;
  session.updatedAt = new Date().toISOString();
  sessions.set(sessionId, session);

  // Build updated A2UI phase component
  const phaseItems = buildPhaseItems();

  const phaseComponent: ConversationPhaseComponent = {
    type: "ConversationPhase",
    id: "phase-indicator",
    phases: phaseItems,
    currentPhase,
  };

  const a2uiResource = createA2UIResource(
    phaseComponent,
    `a2ui://kickstart/session/${sessionId}/phase`,
  );

  const currentDef = getPhaseDefinition(currentPhase);
  const isAtEnd = !PHASE_DEFINITIONS.find((p) => p.id === currentPhase)?.nextPhase;
  const statusText = isAtEnd
    ? "**All phases complete.** Your deployment plan is ready."
    : `Now in **${currentDef.label}** phase: ${currentDef.description}`;

  const content: Array<{ type: "text"; text: string } | { type: "resource"; resource: { uri: string; mimeType: string; text: string } }> = [
    { type: "text", text: statusText },
  ];
  if (a2uiResource) content.push(a2uiResource);

  return { content };
}
