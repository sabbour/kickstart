/**
 * Tests for agents-route-planner.ts
 *
 * Validates:
 * - Route lanes map correctly to phases
 * - Generate phase gets generate deployment when routing is trusted
 * - Non-trusted sessions always get chat deployment
 * - phaseComplete advisory flag triggers shouldAdvancePhase
 * - applyRoutePlan advances phase when shouldAdvancePhase is true
 * - toSafePhase fails closed to Discover for unknown input
 */

import { describe, expect, it } from "vitest";
import { Phase } from "@kickstart/core";
import {
  planRoute,
  applyRoutePlan,
  toSafePhase,
} from "./agents-route-planner.js";
import { createSession } from "./session-store.js";

const DEPLOYMENTS = { chat: "gpt-5.4-mini", generate: "gpt-5.4" };

function makeSession(phase: Phase, trusted = true) {
  const s = createSession("test-principal");
  s.state.currentPhase = phase;
  s.routingPhaseTrusted = trusted;
  return s;
}

describe("planRoute", () => {
  it("maps Discover phase to discover lane with chat deployment", () => {
    const session = makeSession(Phase.Discover);
    const plan = planRoute(session, {}, DEPLOYMENTS);
    expect(plan.lane).toBe("discover");
    expect(plan.deployment).toBe("gpt-5.4-mini");
    expect(plan.pricingGroup).toBe("chat");
  });

  it("maps Generate phase (trusted) to generate deployment", () => {
    const session = makeSession(Phase.Generate, true);
    const plan = planRoute(session, {}, DEPLOYMENTS);
    expect(plan.lane).toBe("generate");
    expect(plan.deployment).toBe("gpt-5.4");
    expect(plan.pricingGroup).toBe("generate");
  });

  it("maps Generate phase (untrusted/rehydrated) to chat deployment", () => {
    const session = makeSession(Phase.Generate, false);
    const plan = planRoute(session, {}, DEPLOYMENTS);
    expect(plan.lane).toBe("generate");
    expect(plan.deployment).toBe("gpt-5.4-mini");
    expect(plan.pricingGroup).toBe("chat");
  });

  it("sets shouldAdvancePhase when phaseComplete advisory is true", () => {
    const session = makeSession(Phase.Discover);
    const plan = planRoute(session, { phaseComplete: true }, DEPLOYMENTS);
    expect(plan.shouldAdvancePhase).toBe(true);
  });

  it("does not advance phase when phaseComplete is false", () => {
    const session = makeSession(Phase.Discover);
    const plan = planRoute(session, { phaseComplete: false }, DEPLOYMENTS);
    expect(plan.shouldAdvancePhase).toBe(false);
  });

  it("sets shouldAutoContinue when filesComplete is false", () => {
    const session = makeSession(Phase.Generate, true);
    const plan = planRoute(session, { filesComplete: false }, DEPLOYMENTS);
    expect(plan.shouldAutoContinue).toBe(true);
  });

  it("does not auto-continue when filesComplete is null", () => {
    const session = makeSession(Phase.Generate, true);
    const plan = planRoute(session, { filesComplete: null }, DEPLOYMENTS);
    expect(plan.shouldAutoContinue).toBe(false);
  });

  it("maps all six phases to correct lanes", () => {
    const expected: Record<Phase, string> = {
      [Phase.Discover]: "discover",
      [Phase.Design]: "design",
      [Phase.Generate]: "generate",
      [Phase.Review]: "review",
      [Phase.Handoff]: "handoff",
      [Phase.Deploy]: "deploy",
    };
    for (const [phase, lane] of Object.entries(expected) as [Phase, string][]) {
      const session = makeSession(phase);
      const plan = planRoute(session, {}, DEPLOYMENTS);
      expect(plan.lane).toBe(lane);
    }
  });
});

describe("applyRoutePlan", () => {
  it("advances phase when shouldAdvancePhase is true", () => {
    const session = makeSession(Phase.Discover);
    const plan = planRoute(session, { phaseComplete: true }, DEPLOYMENTS);
    expect(plan.shouldAdvancePhase).toBe(true);
    applyRoutePlan(session, plan);
    expect(session.state.currentPhase).toBe(Phase.Design);
  });

  it("does not advance phase when shouldAdvancePhase is false", () => {
    const session = makeSession(Phase.Discover);
    const plan = planRoute(session, { phaseComplete: false }, DEPLOYMENTS);
    applyRoutePlan(session, plan);
    expect(session.state.currentPhase).toBe(Phase.Discover);
  });

  it("stays at terminal phase (Deploy) when advance is requested", () => {
    const session = makeSession(Phase.Deploy);
    const plan = planRoute(session, { phaseComplete: true }, DEPLOYMENTS);
    applyRoutePlan(session, plan);
    // advancePhase returns same phase at terminal
    expect(session.state.currentPhase).toBe(Phase.Deploy);
  });
});

describe("toSafePhase", () => {
  it("returns valid Phase unchanged", () => {
    expect(toSafePhase(Phase.Generate)).toBe(Phase.Generate);
    expect(toSafePhase("design")).toBe(Phase.Design);
  });

  it("fails closed to Discover for unknown values", () => {
    expect(toSafePhase("unknown-phase")).toBe(Phase.Discover);
    expect(toSafePhase("")).toBe(Phase.Discover);
  });
});
