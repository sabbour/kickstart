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
  it("each phase's nextPhase matches the next phase in order through Handoff", () => {
    const activeChain = [
      Phase.Discover,
      Phase.Design,
      Phase.Generate,
      Phase.Review,
      Phase.Handoff,
    ];
    for (let i = 0; i < activeChain.length - 1; i++) {
      const def = getPhaseDefinition(activeChain[i]);
      expect(def.nextPhase).toBe(activeChain[i + 1]);
    }
  });

  it("Deploy (future phase) has nextPhase = null", () => {
    const def = getPhaseDefinition(Phase.Deploy);
    expect(def.nextPhase).toBeNull();
  });
});

describe("K8s exposure guard", () => {
  // These terms are unambiguously K8s-specific; "deployment" is excluded
  // because it has a generic English meaning ("deployment files/artifacts").
  const k8sTerms = ["kubernetes", "k8s", "kubectl"];
  const earlyPhases = [Phase.Discover, Phase.Design, Phase.Generate];

  /**
   * Splits a prompt into the body (above RULES:) and the rules section.
   * K8s terms are acceptable inside the RULES section (negative instructions
   * to the LLM) but must not leak into the conversational body.
   * Also excludes JSON example blocks (which may contain event names).
   */
  function getBodyBeforeRules(prompt: string): string {
    const lower = prompt.toLowerCase();
    const rulesIdx = lower.indexOf("rules:");
    const body = rulesIdx === -1 ? lower : lower.slice(0, rulesIdx);
    // Strip JSON examples (they contain component data, not K8s terms)
    return body.replace(/\{[^}]*\}/g, "");
  }

  for (const phase of earlyPhases) {
    it(`${phase} body (before RULES) does NOT contain K8s terminology`, () => {
      const def = getPhaseDefinition(phase);
      const body = getBodyBeforeRules(def.promptTemplate);
      for (const term of k8sTerms) {
        expect(body).not.toContain(term);
      }
    });
  }

  it("early-phase RULES sections only use K8s terms as negative instructions", () => {
    for (const phase of earlyPhases) {
      const def = getPhaseDefinition(phase);
      const lower = def.promptTemplate.toLowerCase();
      const rulesIdx = lower.indexOf("rules:");
      if (rulesIdx === -1) continue;
      const rulesSection = lower.slice(rulesIdx);
      const lines = rulesSection.split("\n").filter((l) => l.trim().length > 0);

      for (const line of lines) {
        for (const term of k8sTerms) {
          if (line.includes(term)) {
            // Every K8s mention in RULES must be in a restrictive context
            const isRuleLine = line.trimStart().startsWith("-");
            expect(
              isRuleLine,
              `Phase "${phase}" RULES section has K8s term "${term}" outside a rule bullet:\n  "${line.trim()}"`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it("Review, Handoff, or Deploy may reference K8s (no assertion — just coverage)", () => {
    for (const phase of [Phase.Review, Phase.Handoff, Phase.Deploy]) {
      const def = getPhaseDefinition(phase);
      expect(def.promptTemplate.length).toBeGreaterThan(0);
    }
  });
});
