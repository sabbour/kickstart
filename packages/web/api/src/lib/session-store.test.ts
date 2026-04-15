import { describe, expect, it } from "vitest";
import { Phase } from "@kickstart/core";
import { createSession, hydrateSession } from "./session-store.js";

describe("session-store phase hydration", () => {
  it("starts new sessions in discover", () => {
    const session = createSession("principal-123");
    expect(session.engineState.currentPhase).toBe(Phase.Discover);
    expect(session.state.currentPhase).toBe(Phase.Discover);
  });

  it("rehydrates the current phase from client history", () => {
    const session = hydrateSession([
      { role: "assistant", content: "Architecture approved", phase: Phase.Design },
      { role: "assistant", content: "Files generated", phase: Phase.Generate },
      { role: "assistant", content: "Cost reviewed", phase: Phase.Review },
      { role: "assistant", content: "Repo selected", phase: Phase.Handoff },
      { role: "assistant", content: "Ready to deploy", phase: Phase.Deploy },
    ], "principal-123");

    expect(session.engineState.currentPhase).toBe(Phase.Deploy);
    expect(session.state.currentPhase).toBe(Phase.Deploy);
    expect(session.engineState.phaseStatus[Phase.Discover]).toBe("complete");
    expect(session.engineState.phaseStatus[Phase.Design]).toBe("complete");
    expect(session.engineState.phaseStatus[Phase.Generate]).toBe("complete");
    expect(session.engineState.phaseStatus[Phase.Review]).toBe("complete");
    expect(session.engineState.phaseStatus[Phase.Handoff]).toBe("complete");
    expect(session.engineState.phaseStatus[Phase.Deploy]).toBe("active");
  });

  it("falls back to discover when the client history has no usable phase", () => {
    const session = hydrateSession([
      { role: "assistant", content: "Hello there", phase: "unknown-phase" },
      { role: "user", content: "continue" },
    ], "principal-123");

    expect(session.engineState.currentPhase).toBe(Phase.Discover);
    expect(session.state.currentPhase).toBe(Phase.Discover);
  });
});
