import { describe, it, expect } from "vitest";
import {
  PHASE_DEFINITIONS,
  getPhaseDefinition,
  getPhaseOrder,
} from "../engine/phases.js";
import { Phase } from "../engine/types.js";

describe("PHASE_DEFINITIONS", () => {
  it("defines all 6 phases", () => {
    expect(PHASE_DEFINITIONS).toHaveLength(6);
  });

  it("phase order is Discover → Design → Generate → Review → Handoff → Deploy", () => {
    const order = getPhaseOrder();
    expect(order).toEqual([
      Phase.Discover,
      Phase.Design,
      Phase.Generate,
      Phase.Review,
      Phase.Handoff,
      Phase.Deploy,
    ]);
  });
});

describe("getPhaseDefinition", () => {
  it("returns correct definition for each phase", () => {
    for (const phase of getPhaseOrder()) {
      const def = getPhaseDefinition(phase);
      expect(def.id).toBe(phase);
      expect(def.label).toBeTruthy();
      expect(def.description).toBeTruthy();
    }
  });

  it("throws for unknown phase", () => {
    expect(() => getPhaseDefinition("nonexistent" as Phase)).toThrow(
      "Unknown phase: nonexistent",
    );
  });

  it("each phase has a non-empty promptTemplate", () => {
    for (const phase of getPhaseOrder()) {
      const def = getPhaseDefinition(phase);
      expect(def.promptTemplate.length).toBeGreaterThan(0);
    }
  });
});

describe("phase chain", () => {
  it("each phase's nextPhase matches the next phase in order", () => {
    const order = getPhaseOrder();
    for (let i = 0; i < order.length - 1; i++) {
      const def = getPhaseDefinition(order[i]);
      expect(def.nextPhase).toBe(order[i + 1]);
    }
  });

  it("last phase (Deploy) has nextPhase = null", () => {
    const def = getPhaseDefinition(Phase.Deploy);
    expect(def.nextPhase).toBeNull();
  });
});

describe("K8s exposure guard", () => {
  const k8sTerms = ["kubernetes", "k8s", "kubectl", "pod", "deployment"];
  const earlyPhases = [Phase.Discover, Phase.Design, Phase.Generate];

  for (const phase of earlyPhases) {
    it(`${phase} promptTemplate does NOT contain K8s terminology`, () => {
      const def = getPhaseDefinition(phase);
      const lower = def.promptTemplate.toLowerCase();
      for (const term of k8sTerms) {
        expect(lower).not.toContain(term);
      }
    });
  }

  it("Review, Handoff, or Deploy may reference K8s (no assertion — just coverage)", () => {
    // These phases are allowed to mention K8s; we just verify they parse
    for (const phase of [Phase.Review, Phase.Handoff, Phase.Deploy]) {
      const def = getPhaseDefinition(phase);
      expect(def.promptTemplate.length).toBeGreaterThan(0);
    }
  });
});
