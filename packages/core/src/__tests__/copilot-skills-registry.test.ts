/**
 * B-186 — Copilot Skills Registry
 *
 * Tests for:
 *   • CopilotSkillsRegistry — register, unregister, get, getAll, resolve
 *   • AZURE_COPILOT_SKILLS — default skill set
 *   • formatCopilotSkillsPrompt — prompt formatting
 *   • buildSystemPrompt copilotSkillsPrompt injection
 *   • defaultCopilotSkillsRegistry — pre-loaded instance
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  CopilotSkillsRegistry,
  defaultCopilotSkillsRegistry,
  AZURE_COPILOT_SKILLS,
  formatCopilotSkillsPrompt,
} from "../engine/copilot-skills-registry.js";
import type { CopilotSkill } from "../engine/copilot-skills-registry.js";
import { buildSystemPrompt } from "../prompts/system-prompt.js";
import { Phase } from "../engine/types.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSkill(id: string, overrides: Partial<CopilotSkill> = {}): CopilotSkill {
  return {
    id,
    name: `Skill ${id}`,
    description: `Description for ${id}`,
    triggerKeywords: [id],
    documentationUrl: `https://example.com/${id}`,
    extensionName: "Test Extension",
    ...overrides,
  };
}

// ── Registry CRUD ────────────────────────────────────────────────────────────

describe("CopilotSkillsRegistry — CRUD", () => {
  let registry: CopilotSkillsRegistry;

  beforeEach(() => {
    registry = new CopilotSkillsRegistry();
  });

  it("starts empty", () => {
    expect(registry.size).toBe(0);
    expect(registry.getAll()).toEqual([]);
  });

  it("registers and retrieves a skill", () => {
    const skill = makeSkill("test-1");
    registry.register(skill);
    expect(registry.size).toBe(1);
    expect(registry.get("test-1")).toEqual(skill);
  });

  it("overwrites existing skill with same ID", () => {
    registry.register(makeSkill("dup", { name: "Original" }));
    registry.register(makeSkill("dup", { name: "Updated" }));
    expect(registry.size).toBe(1);
    expect(registry.get("dup")!.name).toBe("Updated");
  });

  it("registerAll adds multiple skills", () => {
    registry.registerAll([makeSkill("a"), makeSkill("b"), makeSkill("c")]);
    expect(registry.size).toBe(3);
  });

  it("unregister removes a skill", () => {
    registry.register(makeSkill("to-remove"));
    expect(registry.unregister("to-remove")).toBe(true);
    expect(registry.size).toBe(0);
    expect(registry.get("to-remove")).toBeUndefined();
  });

  it("unregister returns false for non-existent ID", () => {
    expect(registry.unregister("nope")).toBe(false);
  });

  it("clear removes all skills", () => {
    registry.registerAll([makeSkill("x"), makeSkill("y")]);
    registry.clear();
    expect(registry.size).toBe(0);
  });
});

// ── Registry resolve ─────────────────────────────────────────────────────────

describe("CopilotSkillsRegistry — resolve", () => {
  let registry: CopilotSkillsRegistry;

  beforeEach(() => {
    registry = new CopilotSkillsRegistry();
    registry.registerAll([
      makeSkill("aks", { triggerKeywords: ["kubernetes", "aks", "cluster"] }),
      makeSkill("sql", { triggerKeywords: ["sql database", "azure sql"] }),
      makeSkill("functions", { triggerKeywords: ["serverless", "azure functions"] }),
    ]);
  });

  it("returns empty when no conversation history", () => {
    const result = registry.resolve();
    expect(result.matched).toEqual([]);
    expect(result.promptSection).toBe("");
  });

  it("returns empty when conversation history is empty array", () => {
    const result = registry.resolve([]);
    expect(result.matched).toEqual([]);
  });

  it("matches skills by keyword in conversation", () => {
    const result = registry.resolve(["I want to deploy to a kubernetes cluster"]);
    expect(result.matched.length).toBe(1);
    expect(result.matched[0].id).toBe("aks");
  });

  it("matches multiple skills when multiple keywords hit", () => {
    const result = registry.resolve([
      "I need a kubernetes cluster with an azure sql database",
    ]);
    expect(result.matched.length).toBe(2);
    const ids = result.matched.map((s) => s.id);
    expect(ids).toContain("aks");
    expect(ids).toContain("sql");
  });

  it("keyword matching is case-insensitive", () => {
    const result = registry.resolve(["Deploy to AKS cluster"]);
    expect(result.matched.length).toBe(1);
    expect(result.matched[0].id).toBe("aks");
  });

  it("no match returns empty matched array", () => {
    const result = registry.resolve(["I want to build a React app"]);
    expect(result.matched).toEqual([]);
    expect(result.promptSection).toBe("");
  });

  it("scans across multiple conversation messages", () => {
    const result = registry.resolve([
      "First, set up the backend",
      "I'll use serverless functions",
    ]);
    expect(result.matched.length).toBe(1);
    expect(result.matched[0].id).toBe("functions");
  });
});

// ── formatCopilotSkillsPrompt ────────────────────────────────────────────────

describe("formatCopilotSkillsPrompt", () => {
  it("returns empty string for empty skills array", () => {
    expect(formatCopilotSkillsPrompt([])).toBe("");
  });

  it("formats skills into a markdown section", () => {
    const prompt = formatCopilotSkillsPrompt([
      makeSkill("test", {
        name: "Test Skill",
        extensionName: "Test Extension",
        description: "Does testing things",
        documentationUrl: "https://example.com/test",
      }),
    ]);

    expect(prompt).toContain("## Copilot Extensions");
    expect(prompt).toContain("**Test Skill**");
    expect(prompt).toContain("Test Extension");
    expect(prompt).toContain("Does testing things");
    expect(prompt).toContain("https://example.com/test");
    expect(prompt).toContain("Do NOT attempt to invoke");
  });

  it("lists multiple skills", () => {
    const prompt = formatCopilotSkillsPrompt([
      makeSkill("a", { name: "Skill A" }),
      makeSkill("b", { name: "Skill B" }),
    ]);

    expect(prompt).toContain("**Skill A**");
    expect(prompt).toContain("**Skill B**");
  });
});

// ── AZURE_COPILOT_SKILLS ─────────────────────────────────────────────────────

describe("AZURE_COPILOT_SKILLS", () => {
  it("contains at least 5 skills", () => {
    expect(AZURE_COPILOT_SKILLS.length).toBeGreaterThanOrEqual(5);
  });

  it("all skills have required fields", () => {
    for (const skill of AZURE_COPILOT_SKILLS) {
      expect(skill.id).toBeTruthy();
      expect(skill.name).toBeTruthy();
      expect(skill.description).toBeTruthy();
      expect(skill.triggerKeywords.length).toBeGreaterThan(0);
      expect(skill.documentationUrl).toMatch(/^https:\/\//);
      expect(skill.extensionName).toBe("GitHub Copilot for Azure");
    }
  });

  it("has unique IDs", () => {
    const ids = AZURE_COPILOT_SKILLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes AKS skill", () => {
    const aks = AZURE_COPILOT_SKILLS.find((s) => s.id === "copilot-azure-aks");
    expect(aks).toBeDefined();
    expect(aks!.triggerKeywords).toContain("kubernetes");
  });

  it("includes App Service skill", () => {
    const appService = AZURE_COPILOT_SKILLS.find(
      (s) => s.id === "copilot-azure-app-service",
    );
    expect(appService).toBeDefined();
  });

  it("includes Azure Functions skill", () => {
    const functions = AZURE_COPILOT_SKILLS.find(
      (s) => s.id === "copilot-azure-functions",
    );
    expect(functions).toBeDefined();
    expect(functions!.triggerKeywords).toContain("serverless");
  });

  it("includes Container Apps skill", () => {
    const aca = AZURE_COPILOT_SKILLS.find(
      (s) => s.id === "copilot-azure-container-apps",
    );
    expect(aca).toBeDefined();
  });

  it("includes Azure SQL skill", () => {
    const sql = AZURE_COPILOT_SKILLS.find(
      (s) => s.id === "copilot-azure-sql",
    );
    expect(sql).toBeDefined();
  });
});

// ── defaultCopilotSkillsRegistry ─────────────────────────────────────────────

describe("defaultCopilotSkillsRegistry", () => {
  it("is pre-loaded with Azure skills", () => {
    expect(defaultCopilotSkillsRegistry.size).toBe(AZURE_COPILOT_SKILLS.length);
  });

  it("resolves AKS skill from kubernetes conversation", () => {
    const result = defaultCopilotSkillsRegistry.resolve([
      "I need to deploy my app to kubernetes",
    ]);
    expect(result.matched.some((s) => s.id === "copilot-azure-aks")).toBe(true);
    expect(result.promptSection).toContain("## Copilot Extensions");
  });
});

// ── buildSystemPrompt integration ────────────────────────────────────────────

describe("buildSystemPrompt with copilotSkillsPrompt", () => {
  it("injects Copilot Extensions section when copilotSkillsPrompt is provided", () => {
    const skillsPrompt = formatCopilotSkillsPrompt([
      makeSkill("test", { name: "Test Copilot Skill" }),
    ]);
    const prompt = buildSystemPrompt({
      phase: Phase.Design,
      copilotSkillsPrompt: skillsPrompt,
    });

    expect(prompt).toContain("## Copilot Extensions");
    expect(prompt).toContain("Test Copilot Skill");
  });

  it("does not inject section when copilotSkillsPrompt is empty string", () => {
    const prompt = buildSystemPrompt({
      phase: Phase.Design,
      copilotSkillsPrompt: "",
    });

    expect(prompt).not.toContain("## Copilot Extensions");
  });

  it("does not inject section when copilotSkillsPrompt is undefined", () => {
    const prompt = buildSystemPrompt({
      phase: Phase.Design,
    });

    expect(prompt).not.toContain("## Copilot Extensions");
  });

  it("places Copilot Extensions after Available Capabilities", () => {
    const skillsPrompt = formatCopilotSkillsPrompt([
      makeSkill("test", { name: "Ext Skill" }),
    ]);
    const prompt = buildSystemPrompt({
      phase: Phase.Design,
      kitPrompts: ["Some kit capability"],
      copilotSkillsPrompt: skillsPrompt,
    });

    const capIdx = prompt.indexOf("## Available Capabilities");
    const extIdx = prompt.indexOf("## Copilot Extensions");
    expect(capIdx).toBeGreaterThan(-1);
    expect(extIdx).toBeGreaterThan(capIdx);
  });
});
