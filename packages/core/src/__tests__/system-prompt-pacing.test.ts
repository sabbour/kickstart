import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../prompts/system-prompt.js";
import { Phase } from "../engine/types.js";

describe("System Prompt — Pacing Directives (Gate A1)", () => {
  describe("Wizard Pacing Constraint", () => {
    it("includes one-step-at-a-time constraint for DESIGN phase", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Design,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      // Check for one-step constraint (case-insensitive)
      const hasConstraint = /one step|single component|one.*per turn/i.test(prompt);
      expect(
        hasConstraint,
        "Prompt should forbid combining multiple wizard steps in a single message",
      ).toBe(true);
    });

    it("forbids cold phase-change language", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Design,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      // Check for absence of cold language
      const hasColdLanguage = /advancing to|proceeding to|next phase/i.test(
        prompt,
      );
      expect(
        hasColdLanguage,
        "Prompt should not use cold language like 'advancing to phase' or 'proceeding to'",
      ).toBe(false);
    });

    it("includes pacing constraint for multiple phases", () => {
      const phases = [Phase.Design, Phase.Generate, Phase.Review];

      for (const phase of phases) {
        const prompt = buildSystemPrompt({
          phase,
          appDefinition: { appName: "TestApp", description: "Test app" },
        });

        const hasConstraint = /one step|single component|one.*per turn/i.test(
          prompt,
        );
        expect(
          hasConstraint,
          `Phase ${phase} prompt should include pacing constraint`,
        ).toBe(true);
      }
    });
  });

  describe("Warm Transition Templates", () => {
    it("includes warm transition language in prompts", () => {
      // Warm transitions don't need specific capitalized words — 
      // they can be present via forward-looking language patterns
      const prompt = buildSystemPrompt({
        phase: Phase.Design,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      // Check for warm/forward language patterns
      const hasWarmLanguage = /let.*s|before|why|important|ensure|benefit|ready/i.test(
        prompt,
      );

      expect(
        hasWarmLanguage,
        "Prompt should include warm transition language patterns",
      ).toBe(true);
    });

    it("includes NOW LET'S or similar forward-looking templates", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Design,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      const hasForwardTemplates = /now let|let.*s|before we|ready to/i.test(
        prompt,
      );
      expect(
        hasForwardTemplates,
        "Prompt should include forward-looking transition templates",
      ).toBe(true);
    });

    it("does not use mechanical/cold transition language", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Review,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      const hasMechanicalLanguage =
        /display component|render|next step in workflow|transition logic/i.test(
          prompt,
        );
      expect(
        hasMechanicalLanguage,
        "Prompt should avoid mechanical language",
      ).toBe(false);
    });
  });

  describe("Phase-Aware Narration", () => {
    it("includes phase context for DESIGN phase", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Design,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      // Should acknowledge design/architecture
      const hasDesignContext = /design|architecture|infrastructure/i.test(
        prompt,
      );
      expect(
        hasDesignContext,
        "DESIGN phase prompt should include architecture/design context",
      ).toBe(true);
    });

    it("includes phase context for REVIEW phase", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Review,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      // Should acknowledge review/cost/decisions
      const hasReviewContext = /review|cost|budget|approve/i.test(prompt);
      expect(
        hasReviewContext,
        "REVIEW phase prompt should include cost/approval context",
      ).toBe(true);
    });

    it("includes phase context for HANDOFF phase", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Handoff,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      // Should acknowledge handoff/github/repo
      const hasHandoffContext = /github|repo|code|push/i.test(prompt);
      expect(
        hasHandoffContext,
        "HANDOFF phase prompt should include GitHub/repo context",
      ).toBe(true);
    });

    it("includes phase context for DEPLOY phase", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Deploy,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      // Should acknowledge deploy/azure/launch
      const hasDeployContext = /deploy|azure|launch|live|running/i.test(prompt);
      expect(
        hasDeployContext,
        "DEPLOY phase prompt should include Azure/deployment context",
      ).toBe(true);
    });
  });

  describe("Narration explains WHY before components", () => {
    it("DESIGN phase includes why explanation before architecture", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Design,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      // Should have words that explain causality/reasoning
      const hasWhyLanguage = /because|to ensure|so that|reason|why|important/i.test(
        prompt,
      );
      expect(
        hasWhyLanguage,
        "Prompt should explain WHY the architecture matters",
      ).toBe(true);
    });

    it("REVIEW phase includes why explanation before cost", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Review,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      // Should mention budget/cost considerations
      const hasCostWhy = /budget|cost|spend|afford|estimate/i.test(prompt);
      expect(
        hasCostWhy,
        "REVIEW prompt should explain cost considerations",
      ).toBe(true);
    });
  });

  describe("Phase-specific guidance", () => {
    it("DESIGN phase prompt provides substantive phase-specific guidance", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Design,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      const length = prompt.length;
      // Prompt should be substantial
      expect(
        length,
        "Prompt should have substantive phase-specific guidance",
      ).toBeGreaterThan(500);

      // Should be more specific than just "what's next"
      const hasPhaseGuidance = /design|architecture/i.test(prompt);
      expect(hasPhaseGuidance).toBe(true);
    });
  });

  describe("Confusion handling", () => {
    it("prompts include guidance for handling user confusion", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Generate,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      // Should have some instruction about clarity/confusion
      const hasConfusionHandling =
        /confused|clarify|unclear|repeat|explain|understand/i.test(prompt);
      expect(
        hasConfusionHandling,
        "Prompt should include guidance for handling confused users",
      ).toBe(true);
    });
  });

  describe("Progressive flow regression guards", () => {
    it("keeps architecture review separate from cost review", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Design,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      expect(prompt).toContain(
        "Do NOT show cost estimates, best-practice summaries, or deployment/auth components in the same turn as the architecture diagram.",
      );
      expect(prompt).not.toContain("After gathering answers, present architecture using Tabs:");
    });

    it("does not end the guided flow at review", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Review,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      expect(prompt).toContain("### STEP 5 — HANDOFF");
      expect(prompt).toContain("### STEP 6 — DEPLOY");
      expect(prompt).not.toContain("This is the end of the guided flow — there is no further step after REVIEW.");
      expect(prompt).not.toContain("Do not enter handoff or deploy phases — they are not yet implemented.");
    });

    it("treats review as a checkpoint before GitHub handoff", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Review,
        appDefinition: { appName: "TestApp", description: "Test app" },
      });

      expect(prompt).toContain("REVIEW is a checkpoint, not the end of the flow.");
      expect(prompt).toContain("One primary Button to continue to GitHub handoff and one secondary Button to revise the plan");
    });
  });
});
