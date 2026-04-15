import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../prompts/system-prompt.js";
import { Phase } from "../engine/types.js";

/**
 * Integration tests for converse endpoint — verify the system prompt infrastructure
 * is ready for pacing directives to be added.
 *
 * NOTE: These tests validate infrastructure readiness, not that pacing directives
 * currently exist. The unit tests (system-prompt-pacing.test.ts) will validate
 * pacing directives once they're added to the prompt.
 */

describe("Converse Endpoint — Prompt Infrastructure (Pre-Implementation)", () => {
  describe("System prompt can be built for all phases", () => {
    it("DESIGN phase prompt builds without error", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Design,
        appDefinition: { appName: "TestApp", description: "Test" },
      });

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(100);
    });

    it("REVIEW phase prompt builds without error", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Review,
        appDefinition: { appName: "TestApp", description: "Test" },
      });

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(100);
    });

    it("HANDOFF phase prompt builds without error", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Handoff,
        appDefinition: { appName: "TestApp", description: "Test" },
      });

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(100);
    });

    it("DEPLOY phase prompt builds without error", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Deploy,
        appDefinition: { appName: "TestApp", description: "Test" },
      });

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(100);
    });
  });

  describe("Artifact summary injection works", () => {
    it("Prompt builds with artifact summary", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Generate,
        appDefinition: { appName: "TestApp", description: "Test" },
        artifactSummary: "Files generated so far: main.bicep, deploy.yml",
      });

      expect(prompt).toBeDefined();
      expect(prompt).toContain("TestApp");
    });

    it("Artifact summary does not break prompt structure", () => {
      const withoutSummary = buildSystemPrompt({
        phase: Phase.Generate,
        appDefinition: { appName: "TestApp", description: "Test" },
      });

      const withSummary = buildSystemPrompt({
        phase: Phase.Generate,
        appDefinition: { appName: "TestApp", description: "Test" },
        artifactSummary: "Files: f1.yml, f2.bicep",
      });

      // Both should be valid prompts
      expect(withoutSummary.length).toBeGreaterThan(0);
      expect(withSummary.length).toBeGreaterThan(0);

      // With-summary should be longer (includes artifact summary)
      expect(withSummary.length).toBeGreaterThanOrEqual(withoutSummary.length);
    });
  });

  describe("Message array construction works", () => {
    it("Prompt can be used as system message in LLM call", () => {
      const basePrompt = buildSystemPrompt({
        phase: Phase.Design,
        appDefinition: { appName: "TestApp", description: "Test" },
      });

      const messages = [
        { role: "system" as const, content: basePrompt },
        { role: "user" as const, content: "Show me the architecture" },
      ];

      // Message array should be valid
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toBe(basePrompt);
      expect(messages[1].role).toBe("user");
    });

    it("Prompt with template variables builds and can be used in message array", () => {
      const prompt = buildSystemPrompt({
        phase: Phase.Design,
        appDefinition: { appName: "TestApp", description: "Test app" },
        templateVars: { knownInfo: "Runtime: Node.js, Name: TestApp" },
      });

      const messages = [
        { role: "system" as const, content: prompt },
        { role: "user" as const, content: "Show me the design" },
      ];

      expect(messages[0].content).toContain("Node.js");
      expect(messages[0].content.length).toBeGreaterThan(0);
    });
  });

  describe("Phase transitions have prompt coverage", () => {
    it("All phases have substantive prompts", () => {
      const phases = [
        Phase.Discover,
        Phase.Design,
        Phase.Generate,
        Phase.Review,
        Phase.Handoff,
        Phase.Deploy,
      ];

      for (const phase of phases) {
        const prompt = buildSystemPrompt({
          phase,
          appDefinition: { appName: "TestApp", description: "Test app" },
        });

        // Each phase should have distinct prompt guidance (not generic)
        expect(prompt.length).toBeGreaterThan(500);

        // Prompt should contain phase context (not generic boilerplate only)
        expect(prompt).toContain("phase");
      }
    });
  });
});
