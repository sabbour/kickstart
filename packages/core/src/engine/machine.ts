/**
 * @module @kickstart/core/engine/machine
 *
 * Finite state machine for the Kickstart conversation flow.
 * Manages phase transitions based on conversation events.
 */

import { Phase } from "./types.js";
import type { ConversationState, ConversationEvent, PhaseStatus } from "./types.js";
import { getPhaseDefinition, getPhaseOrder } from "./phases.js";
import { logger } from "../telemetry/index.js";

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
      logger.track('conversation.start');
      return createInitialState();

    case "ADVANCE": {
      const currentDef = getPhaseDefinition(next.currentPhase);
      if (!currentDef.nextPhase) {
        next.phaseStatus[next.currentPhase] = "complete";
        next.isComplete = true;
        logger.track('conversation.complete', { phase: next.currentPhase });
        return next;
      }
      next.phaseStatus[next.currentPhase] = "complete";
      next.currentPhase = currentDef.nextPhase;
      next.phaseStatus[currentDef.nextPhase] = "active";
      if (event.data) {
        Object.assign(next.phaseData[currentDef.nextPhase], event.data);
      }
      logger.track('conversation.advance', { from: state.currentPhase, to: next.currentPhase });
      return next;
    }

    case "SKIP": {
      const currentDef = getPhaseDefinition(next.currentPhase);
      if (!currentDef.nextPhase) {
        next.phaseStatus[next.currentPhase] = "skipped";
        next.isComplete = true;
        logger.track('conversation.complete', { phase: next.currentPhase, skipped: true });
        return next;
      }
      next.phaseStatus[next.currentPhase] = "skipped";
      next.currentPhase = currentDef.nextPhase;
      next.phaseStatus[currentDef.nextPhase] = "active";
      logger.track('conversation.skip', { from: state.currentPhase, to: next.currentPhase });
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
        logger.track('conversation.phaseComplete', { phase: event.phase, next: def.nextPhase });
      } else {
        next.isComplete = true;
        logger.track('conversation.complete', { phase: event.phase });
      }
      return next;
    }

    case "RESET":
      logger.track('conversation.reset');
      return createInitialState();

    case "USER_INPUT":
      logger.info(`User input in phase: ${state.currentPhase}`, { length: event.input?.length });
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

/**
 * Implicit state flags parsed from LLM response JSON.
 * These drive auto-transitions without explicit user action.
 */
export interface ImplicitFlags {
  /** When true, advance to the next phase automatically. */
  phaseComplete?: boolean;
  /** During Generate phase: false = more files remain (auto-continue),
   *  true = last batch, null = not applicable. */
  filesComplete?: boolean | null;
}

/**
 * Handle implicit state flags from the LLM response.
 * - phaseComplete: true → advance to next phase (same as ADVANCE event)
 * - filesComplete is informational only — the harness uses it to trigger
 *   auto-continue messages, not state machine transitions.
 *
 * Returns the (possibly advanced) state.
 */
export function handleImplicitFlags(
  state: ConversationState,
  flags: ImplicitFlags,
): ConversationState {
  if (flags.phaseComplete === true && canAdvance(state)) {
    return transition(state, { type: "ADVANCE" });
  }
  return state;
}
