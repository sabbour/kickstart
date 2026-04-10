/**
 * @module @kickstart/mcp-server/tools/action
 *
 * Tool handler: Process user actions from the A2UI interface.
 * Handles phase advancement, resource selection, and form submissions.
 */

import {
  transition,
  getCurrentPhase,
  getPhaseDefinition,
  getPhaseOrder,
  Phase,
} from "@kickstart/core";
import type {
  SessionState,
  ConversationState,
  PhaseItem,
  PhaseStatus,
} from "@kickstart/core";
import { createA2UIResource } from "../a2ui.js";

type ActionType = "advance" | "skip" | "select" | "submit" | "reply" | "navigate" | "api";

/** Local structural type for the ConversationPhase A2UI component. */
interface ConversationPhaseComponent {
  type: "ConversationPhase";
  id: string;
  phases: PhaseItem[];
  currentPhase: Phase;
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

  // Reconstruct engine state from session
  const phases = getPhaseOrder();
  const phaseStatus = {} as Record<Phase, PhaseStatus>;
  for (const phase of phases) {
    if (phase === session.currentPhase) {
      phaseStatus[phase] = "active";
    } else if (phases.indexOf(phase) < phases.indexOf(session.currentPhase as Phase)) {
      phaseStatus[phase] = "complete";
    } else {
      phaseStatus[phase] = "pending";
    }
  }

  let engineState: ConversationState = {
    currentPhase: session.currentPhase as Phase,
    phaseStatus,
    phaseData: Object.fromEntries(phases.map((p) => [p, {}])) as Record<Phase, Record<string, unknown>>,
    isComplete: false,
  };

  // Process action
  switch (actionType) {
    case "advance":
      engineState = transition(engineState, { type: "ADVANCE", data: payload });
      break;

    case "skip":
      engineState = transition(engineState, { type: "SKIP" });
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
      engineState = transition(engineState, { type: "ADVANCE", data: payload });
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
      session.updatedAt = new Date().toISOString();
      sessions.set(sessionId, session);
      const replyDef = getPhaseDefinition(session.currentPhase as Phase);
      return {
        content: [{ type: "text", text: `Received reply in **${replyDef.label}** phase. The conversation will continue from here.` }],
      };
    }

    case "navigate": {
      const targetPhase = payload?.targetPhase;
      if (!targetPhase) {
        session.updatedAt = new Date().toISOString();
        sessions.set(sessionId, session);
        return {
          content: [{ type: "text", text: "Error: Missing required field: `targetPhase` is required for navigate actions." }],
        };
      }
      const validPhases = getPhaseOrder() as string[];
      if (!validPhases.includes(targetPhase as string)) {
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

      // Rebuild phase status for the new current phase
      const navPhases = getPhaseOrder();
      const navPhaseStatus = {} as Record<Phase, PhaseStatus>;
      for (const phase of navPhases) {
        if (phase === session.currentPhase) {
          navPhaseStatus[phase] = "active";
        } else if (navPhases.indexOf(phase) < navPhases.indexOf(session.currentPhase as Phase)) {
          navPhaseStatus[phase] = "complete";
        } else {
          navPhaseStatus[phase] = "pending";
        }
      }
      const navPhaseItems: PhaseItem[] = navPhases.map((phase) => ({
        id: phase,
        label: getPhaseDefinition(phase).label,
        status: navPhaseStatus[phase],
      }));
      const navPhaseComponent: ConversationPhaseComponent = {
        type: "ConversationPhase",
        id: "phase-indicator",
        phases: navPhaseItems,
        currentPhase: session.currentPhase as Phase,
      };
      const navResource = createA2UIResource(
        navPhaseComponent,
        `a2ui://kickstart/session/${sessionId}/phase`,
      );
      const navDef = getPhaseDefinition(session.currentPhase as Phase);
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
  session.currentPhase = getCurrentPhase(engineState);
  session.updatedAt = new Date().toISOString();
  sessions.set(sessionId, session);

  // Build updated A2UI phase component
  const phaseItems: PhaseItem[] = getPhaseOrder().map((phase) => ({
    id: phase,
    label: getPhaseDefinition(phase).label,
    status: engineState.phaseStatus[phase],
  }));

  const phaseComponent: ConversationPhaseComponent = {
    type: "ConversationPhase",
    id: "phase-indicator",
    phases: phaseItems,
    currentPhase: engineState.currentPhase,
  };

  const a2uiResource = createA2UIResource(
    phaseComponent,
    `a2ui://kickstart/session/${sessionId}/phase`,
  );

  const currentDef = getPhaseDefinition(engineState.currentPhase);
  const statusText = engineState.isComplete
    ? "**All phases complete.** Your deployment plan is ready."
    : `Now in **${currentDef.label}** phase: ${currentDef.description}`;

  const content: Array<{ type: "text"; text: string } | { type: "resource"; resource: { uri: string; mimeType: string; text: string } }> = [
    { type: "text", text: statusText },
  ];
  if (a2uiResource) content.push(a2uiResource);

  return { content };
}
