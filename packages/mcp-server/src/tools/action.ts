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
  ConversationPhaseComponent,
  PhaseItem,
  PhaseStatus,
} from "@kickstart/core";
import { createA2UIResource } from "../a2ui.js";

type ActionType = "advance" | "skip" | "select" | "submit";

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
      content: [{ type: "text", text: `❌ Session \`${sessionId}\` not found.` }],
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
      // Store selection data in session
      if (payload) {
        Object.assign(session.appDefinition, payload);
      }
      break;
    case "submit":
      // Store form data and advance
      if (payload) {
        Object.assign(session.appDefinition, payload);
      }
      engineState = transition(engineState, { type: "ADVANCE", data: payload });
      break;
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
    ? "✅ **All phases complete!** Your deployment plan is ready."
    : `Now in **${currentDef.label}** phase: ${currentDef.description}`;

  const content: Array<{ type: "text"; text: string } | { type: "resource"; resource: { uri: string; mimeType: string; text: string } }> = [
    { type: "text", text: statusText },
  ];
  if (a2uiResource) content.push(a2uiResource);

  return { content };
}
