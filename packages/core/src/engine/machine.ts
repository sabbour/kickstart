/**
 * @module @kickstart/core/engine/machine
 *
 * Finite state machine for the Kickstart conversation flow.
 * Manages phase transitions based on conversation events.
 */

import { Phase } from "./types.js";
import type { ConversationState, ConversationEvent, PhaseStatus } from "./types.js";
import { getPhaseDefinition, getPhaseOrder } from "./phases.js";

/** Create a fresh conversation state at the Discover phase. */
export function createInitialState(): ConversationState {
  const phases = getPhaseOrder();
  const phaseStatus = {} as Record<Phase, PhaseStatus>;
  const phaseData = {} as Record<Phase, Record<string, unknown>>;

  for (const phase of phases) {
    phaseStatus[phase] = phase === Phase.Discover ? "active" : "pending";
    phaseData[phase] = {};
  }

  return {
    currentPhase: Phase.Discover,
    phaseStatus,
    phaseData,
    isComplete: false,
  };
}

/**
 * Process a conversation event and return the next state.
 * Pure function — does not mutate the input state.
 */
export function transition(
  state: ConversationState,
  event: ConversationEvent,
): ConversationState {
  const next: ConversationState = JSON.parse(JSON.stringify(state));

  switch (event.type) {
    case "START":
      return createInitialState();

    case "ADVANCE": {
      const currentDef = getPhaseDefinition(next.currentPhase);
      if (!currentDef.nextPhase) {
        next.phaseStatus[next.currentPhase] = "complete";
        next.isComplete = true;
        return next;
      }
      next.phaseStatus[next.currentPhase] = "complete";
      next.currentPhase = currentDef.nextPhase;
      next.phaseStatus[currentDef.nextPhase] = "active";
      if (event.data) {
        Object.assign(next.phaseData[currentDef.nextPhase], event.data);
      }
      return next;
    }

    case "SKIP": {
      const currentDef = getPhaseDefinition(next.currentPhase);
      if (!currentDef.nextPhase) {
        next.phaseStatus[next.currentPhase] = "skipped";
        next.isComplete = true;
        return next;
      }
      next.phaseStatus[next.currentPhase] = "skipped";
      next.currentPhase = currentDef.nextPhase;
      next.phaseStatus[currentDef.nextPhase] = "active";
      return next;
    }

    case "PHASE_COMPLETE": {
      next.phaseStatus[event.phase] = "complete";
      next.phaseData[event.phase] = {
        ...next.phaseData[event.phase],
        ...event.data,
      };
      const def = getPhaseDefinition(event.phase);
      if (def.nextPhase) {
        next.currentPhase = def.nextPhase;
        next.phaseStatus[def.nextPhase] = "active";
      } else {
        next.isComplete = true;
      }
      return next;
    }

    case "RESET":
      return createInitialState();

    case "USER_INPUT":
      // User input is recorded but doesn't change phase state directly.
      // Phase advancement is driven by ADVANCE or PHASE_COMPLETE events
      // after the LLM processes the input.
      return next;

    default:
      return next;
  }
}

/** Get the current phase ID. */
export function getCurrentPhase(state: ConversationState): Phase {
  return state.currentPhase;
}

/** Check if the current phase can advance (all exit conditions are conceptually met). */
export function canAdvance(
  state: ConversationState,
  _phaseData?: Record<string, unknown>,
): boolean {
  // In a real implementation, this would check exit conditions against
  // the accumulated phase data. For now, we allow manual advancement.
  return (
    state.phaseStatus[state.currentPhase] === "active" && !state.isComplete
  );
}
