import { describe, it, expect } from "vitest";
import {
  createInitialState,
  transition,
  getCurrentPhase,
  canAdvance,
} from "../engine/machine.js";
import { Phase } from "../engine/types.js";
import type { ConversationState } from "../engine/types.js";

describe("createInitialState", () => {
  it("returns state with Discover phase active and all others pending", () => {
    const state = createInitialState();

    expect(state.currentPhase).toBe(Phase.Discover);
    expect(state.phaseStatus[Phase.Discover]).toBe("active");
    expect(state.phaseStatus[Phase.Design]).toBe("pending");
    expect(state.phaseStatus[Phase.Generate]).toBe("pending");
    expect(state.phaseStatus[Phase.Review]).toBe("pending");
    expect(state.phaseStatus[Phase.Handoff]).toBe("pending");
    expect(state.phaseStatus[Phase.Deploy]).toBe("pending");
    expect(state.isComplete).toBe(false);
  });
});

describe("transition", () => {
  it("START resets to initial state", () => {
    const state = createInitialState();
    // Advance once to change state
    const advanced = transition(state, { type: "ADVANCE" });
    expect(advanced.currentPhase).toBe(Phase.Design);

    // START should reset
    const reset = transition(advanced, { type: "START" });
    expect(reset.currentPhase).toBe(Phase.Discover);
    expect(reset.phaseStatus[Phase.Discover]).toBe("active");
    expect(reset.isComplete).toBe(false);
  });

  it("ADVANCE moves through all phases in order", () => {
    let state = createInitialState();
    const expectedOrder: Phase[] = [
      Phase.Design,
      Phase.Generate,
      Phase.Review,
      Phase.Handoff,
      Phase.Deploy,
    ];

    for (const expectedPhase of expectedOrder) {
      state = transition(state, { type: "ADVANCE" });
      expect(state.currentPhase).toBe(expectedPhase);
      expect(state.phaseStatus[expectedPhase]).toBe("active");
    }
  });

  it("ADVANCE from Deploy marks isComplete = true", () => {
    let state = createInitialState();
    // Advance through all phases to Deploy
    const phases = [Phase.Design, Phase.Generate, Phase.Review, Phase.Handoff, Phase.Deploy];
    for (const _ of phases) {
      state = transition(state, { type: "ADVANCE" });
    }
    expect(state.currentPhase).toBe(Phase.Deploy);

    // Advance from Deploy
    state = transition(state, { type: "ADVANCE" });
    expect(state.isComplete).toBe(true);
    expect(state.phaseStatus[Phase.Deploy]).toBe("complete");
  });

  it("SKIP marks current phase as skipped and advances to next", () => {
    const state = createInitialState();
    const skipped = transition(state, { type: "SKIP" });

    expect(skipped.phaseStatus[Phase.Discover]).toBe("skipped");
    expect(skipped.currentPhase).toBe(Phase.Design);
    expect(skipped.phaseStatus[Phase.Design]).toBe("active");
  });

  it("PHASE_COMPLETE stores data and advances", () => {
    const state = createInitialState();
    const data = { appName: "my-app", runtime: "node" };
    const completed = transition(state, {
      type: "PHASE_COMPLETE",
      phase: Phase.Discover,
      data,
    });

    expect(completed.phaseStatus[Phase.Discover]).toBe("complete");
    expect(completed.phaseData[Phase.Discover]).toEqual(data);
    expect(completed.currentPhase).toBe(Phase.Design);
    expect(completed.phaseStatus[Phase.Design]).toBe("active");
  });

  it("RESET returns to initial state", () => {
    let state = createInitialState();
    state = transition(state, { type: "ADVANCE" });
    state = transition(state, { type: "ADVANCE" });
    expect(state.currentPhase).toBe(Phase.Generate);

    const reset = transition(state, { type: "RESET" });
    expect(reset.currentPhase).toBe(Phase.Discover);
    expect(reset.phaseStatus[Phase.Discover]).toBe("active");
    expect(reset.isComplete).toBe(false);
  });

  it("USER_INPUT does not change phase state", () => {
    const state = createInitialState();
    const afterInput = transition(state, {
      type: "USER_INPUT",
      input: "I want to build a Node.js app",
    });

    expect(afterInput.currentPhase).toBe(Phase.Discover);
    expect(afterInput.phaseStatus[Phase.Discover]).toBe("active");
    expect(afterInput.isComplete).toBe(false);
  });
});

describe("getCurrentPhase", () => {
  it("returns the current phase", () => {
    const state = createInitialState();
    expect(getCurrentPhase(state)).toBe(Phase.Discover);

    const next = transition(state, { type: "ADVANCE" });
    expect(getCurrentPhase(next)).toBe(Phase.Design);
  });
});

describe("canAdvance", () => {
  it("returns true when phase is active and not complete", () => {
    const state = createInitialState();
    expect(canAdvance(state)).toBe(true);
  });

  it("returns false when conversation is complete", () => {
    let state = createInitialState();
    // Advance through all phases
    for (let i = 0; i < 6; i++) {
      state = transition(state, { type: "ADVANCE" });
    }
    expect(state.isComplete).toBe(true);
    expect(canAdvance(state)).toBe(false);
  });
});

describe("full journey", () => {
  it("START → advance through all 6 phases → isComplete", () => {
    let state = transition(createInitialState(), { type: "START" });
    expect(state.currentPhase).toBe(Phase.Discover);
    expect(state.isComplete).toBe(false);

    const allPhases: Phase[] = [
      Phase.Discover,
      Phase.Design,
      Phase.Generate,
      Phase.Review,
      Phase.Handoff,
      Phase.Deploy,
    ];

    // Verify we start at Discover
    expect(getCurrentPhase(state)).toBe(Phase.Discover);

    // Advance through each phase
    for (let i = 0; i < allPhases.length; i++) {
      expect(state.phaseStatus[allPhases[i]]).toBe("active");
      state = transition(state, { type: "ADVANCE" });
      expect(state.phaseStatus[allPhases[i]]).toBe("complete");
    }

    expect(state.isComplete).toBe(true);
  });
});
