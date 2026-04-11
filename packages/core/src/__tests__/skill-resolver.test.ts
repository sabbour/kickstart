/**
 * B-15 — Skill Resolver
 *
 * Tests for:
 *   • resolveSkills — extracts phase-relevant prompts from IntegrationKits
 *   • phasePrompts (explicit) takes priority over flat prompts
 *   • Keyword heuristic fallback for kits with only flat prompts
 *   • Discover phase: synthetic tool-listing prompt
 *   • Empty kits produce empty result
 *   • formatSkillsSection — markdown formatting
 *   • buildSystemPrompt kitPrompts injection
 */

import { describe, it, expect } from "vitest";
import { Phase } from "../engine/types.js";
import type { Skill } from "../engine/types.js";
import {
  resolveSkills,
  resolveSkillsAsync,
  resolveSkillsFromList,
  formatSkillsSection,
} from "../engine/skill-resolver.js";
import { buildSystemPrompt } from "../prompts/system-prompt.js";
import type { IntegrationKit } from "../kits/types.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeKit(name: string, overrides: Partial<IntegrationKit> = {}): IntegrationKit {
  return {
    name,
    description: `${name} kit`,
    tools: [],
    connectors: [],
    ...overrides,
  };
}

function makeTool(toolName: string) {
  return {
    name: toolName,
    description: `Description of ${toolName}`,
    parameters: { type: "object" as const, properties: {} },
    execute: async () => ({}),
  };
}

function makeSkill(id: string, overrides: Partial<Skill> = {}): Skill {
  return {
    id,
    name: `Skill ${id}`,
    phases: [Phase.Generate],
    keywords: [id],
    content: `Content for ${id}`,
    priority: 0,
    ...overrides,
  };
}

// ── resolveSkills — no kits ──────────────────────────────────────────────────

describe("resolveSkills — no kits", () => {
  for (const phase of Object.values(Phase)) {
    it(`returns empty result for ${phase} phase with no kits`, () => {
      const result = resolveSkills(phase as Phase, []);
      expect(result.prompts).toEqual([]);
      expect(result.availableTools).toEqual([]);
    });
  }
});

// ── resolveSkills — explicit phasePrompts ────────────────────────────────────

describe("resolveSkills — explicit phasePrompts", () => {
  it("injects phasePrompts for the current phase", () => {
    const kit = makeKit("test-kit", {
      phasePrompts: {
        [Phase.Design]: ["Design phase prompt A", "Design phase prompt B"],
        [Phase.Generate]: ["Generate phase prompt"],
      },
    });

    const result = resolveSkills(Phase.Design, [kit]);
    expect(result.prompts).toContain("Design phase prompt A");
    expect(result.prompts).toContain("Design phase prompt B");
    expect(result.prompts).not.toContain("Generate phase prompt");
  });

  it("does not inject phasePrompts for other phases", () => {
    const kit = makeKit("test-kit", {
      phasePrompts: {
        [Phase.Review]: ["Review-only prompt"],
      },
    });

    const discover = resolveSkills(Phase.Discover, [kit]);
    expect(discover.prompts).not.toContain("Review-only prompt");

    const review = resolveSkills(Phase.Review, [kit]);
    expect(review.prompts).toContain("Review-only prompt");
  });

  it("phasePrompts takes priority over flat prompts for same kit", () => {
    const kit = makeKit("priority-kit", {
      prompts: ["Flat discover prompt about discover list existing"],
      phasePrompts: {
        [Phase.Discover]: ["Explicit discover phase prompt"],
      },
    });

    const result = resolveSkills(Phase.Discover, [kit]);
    expect(result.prompts).toContain("Explicit discover phase prompt");
    // flat prompt should NOT appear since phasePrompts takes priority
    expect(result.prompts).not.toContain("Flat discover prompt about discover list existing");
  });
});

// ── resolveSkills — flat prompts keyword heuristic ───────────────────────────

describe("resolveSkills — keyword heuristic fallback", () => {
  it("includes discover-keyword prompts only in Discover phase", () => {
    const kit = makeKit("heuristic-kit", {
      prompts: ["Use resource_list tool to discover existing resources"],
    });

    const discover = resolveSkills(Phase.Discover, [kit]);
    expect(discover.prompts.length).toBeGreaterThan(0);
    const discovered = discover.prompts.some((p) =>
      p.includes("discover existing resources")
    );
    expect(discovered).toBe(true);
  });

  it("includes architecture-keyword prompts in Design phase", () => {
    const kit = makeKit("arch-kit", {
      prompts: ["Recommend AKS Automatic for architecture design"],
    });

    const design = resolveSkills(Phase.Design, [kit]);
    const hasArchPrompt = design.prompts.some((p) =>
      p.includes("AKS Automatic for architecture design")
    );
    expect(hasArchPrompt).toBe(true);
  });

  it("includes deploy-keyword prompts in Review, Handoff, Deploy phases", () => {
    const kit = makeKit("deploy-kit", {
      prompts: ["Validate deployment safeguards before production release"],
    });

    for (const phase of [Phase.Review, Phase.Handoff, Phase.Deploy]) {
      const result = resolveSkills(phase, [kit]);
      const hasPrompt = result.prompts.some((p) =>
        p.includes("safeguards")
      );
      expect(hasPrompt).toBe(true);
    }
  });

  it("includes unclassified prompts in all phases", () => {
    const kit = makeKit("general-kit", {
      prompts: ["Always be helpful and concise in your responses."],
    });

    for (const phase of Object.values(Phase)) {
      const result = resolveSkills(phase as Phase, [kit]);
      const hasPrompt = result.prompts.some((p) =>
        p.includes("Always be helpful")
      );
      expect(hasPrompt).toBe(true);
    }
  });
});

// ── resolveSkills — Discover tool listing ────────────────────────────────────

describe("resolveSkills — Discover tool listing", () => {
  it("injects a synthetic tool-listing prompt in Discover phase", () => {
    const kit = makeKit("tool-kit", {
      tools: [makeTool("my_tool_one"), makeTool("my_tool_two")],
    });

    const result = resolveSkills(Phase.Discover, [kit]);

    expect(result.availableTools).toContain("my_tool_one");
    expect(result.availableTools).toContain("my_tool_two");

    // Should have a generated prompt listing the tools
    const hasSyntheticPrompt = result.prompts.some((p) =>
      p.includes("my_tool_one") && p.includes("my_tool_two")
    );
    expect(hasSyntheticPrompt).toBe(true);
  });

  it("does not inject synthetic tool listing in non-Discover phases", () => {
    const kit = makeKit("tool-kit", {
      tools: [makeTool("my_secret_tool")],
    });

    const result = resolveSkills(Phase.Generate, [kit]);
    // availableTools should still be populated
    expect(result.availableTools).toContain("my_secret_tool");
    // but no synthetic "You have access to" prompt
    const hasSyntheticPrompt = result.prompts.some((p) =>
      p.includes("You have access to the following tools")
    );
    expect(hasSyntheticPrompt).toBe(false);
  });
});

// ── resolveSkills — multiple kits ────────────────────────────────────────────

describe("resolveSkills — multiple kits", () => {
  it("collects prompts from all kits", () => {
    const kitA = makeKit("kit-a", {
      phasePrompts: { [Phase.Design]: ["Kit A design prompt"] },
    });
    const kitB = makeKit("kit-b", {
      phasePrompts: { [Phase.Design]: ["Kit B design prompt"] },
    });

    const result = resolveSkills(Phase.Design, [kitA, kitB]);
    expect(result.prompts).toContain("Kit A design prompt");
    expect(result.prompts).toContain("Kit B design prompt");
  });

  it("collects tools from all kits", () => {
    const kitA = makeKit("kit-a", { tools: [makeTool("tool_a")] });
    const kitB = makeKit("kit-b", { tools: [makeTool("tool_b")] });

    const result = resolveSkills(Phase.Discover, [kitA, kitB]);
    expect(result.availableTools).toContain("tool_a");
    expect(result.availableTools).toContain("tool_b");
  });
});

// ── formatSkillsSection ──────────────────────────────────────────────────────

describe("formatSkillsSection", () => {
  it("returns empty string when no prompts", () => {
    expect(formatSkillsSection({ prompts: [], availableTools: [] })).toBe("");
  });

  it("formats a section with the correct markdown header", () => {
    const section = formatSkillsSection({
      prompts: ["Prompt one", "Prompt two"],
      availableTools: [],
    });
    expect(section).toContain("## Available Capabilities");
    expect(section).toContain("Prompt one");
    expect(section).toContain("Prompt two");
  });
});

// ── buildSystemPrompt kitPrompts injection ───────────────────────────────────

describe("buildSystemPrompt with kitPrompts", () => {
  it("appends kit prompts as Available Capabilities section", () => {
    const prompt = buildSystemPrompt({
      phase: Phase.Design,
      kitPrompts: ["Always prefer managed services", "Use AKS Automatic"],
    });

    expect(prompt).toContain("## Available Capabilities");
    expect(prompt).toContain("Always prefer managed services");
    expect(prompt).toContain("Use AKS Automatic");
  });

  it("does not add Available Capabilities section when kitPrompts is empty", () => {
    const withKitPrompts = buildSystemPrompt({
      phase: Phase.Design,
      kitPrompts: ["Some kit prompt"],
    });
    const withoutKitPrompts = buildSystemPrompt({
      phase: Phase.Design,
      kitPrompts: [],
    });

    expect(withKitPrompts).toContain("## Available Capabilities");
    expect(withoutKitPrompts).not.toContain("## Available Capabilities");
  });

  it("places Available Capabilities after the phase prompt", () => {
    const prompt = buildSystemPrompt({
      phase: Phase.Discover,
      kitPrompts: ["Kit insight here"],
    });

    const phaseIdx = prompt.indexOf("## Current Phase");
    const capIdx = prompt.indexOf("## Available Capabilities");
    expect(phaseIdx).toBeGreaterThan(-1);
    expect(capIdx).toBeGreaterThan(phaseIdx);
  });
});

// ── azureKit phasePrompts ────────────────────────────────────────────────────

describe("azureKit phasePrompts", () => {
  it("has phasePrompts defined", async () => {
    const { azureKit } = await import("../kits/azure-kit.js");
    expect(azureKit.phasePrompts).toBeDefined();
  });

  it("has Discover phase prompts mentioning azure_resource_list", async () => {
    const { azureKit } = await import("../kits/azure-kit.js");
    const discoverPrompts = azureKit.phasePrompts?.[Phase.Discover] ?? [];
    const hasToolRef = discoverPrompts.some((p) =>
      p.includes("azure_resource_list")
    );
    expect(hasToolRef).toBe(true);
  });

  it("has Generate phase prompts mentioning Gateway API", async () => {
    const { azureKit } = await import("../kits/azure-kit.js");
    const generatePrompts = azureKit.phasePrompts?.[Phase.Generate] ?? [];
    const hasGateway = generatePrompts.some((p) =>
      p.toLowerCase().includes("gateway")
    );
    expect(hasGateway).toBe(true);
  });
});

// ── githubKit phasePrompts ───────────────────────────────────────────────────

describe("githubKit phasePrompts", () => {
  it("has phasePrompts defined", async () => {
    const { githubKit } = await import("../kits/github-kit.js");
    expect(githubKit.phasePrompts).toBeDefined();
  });

  it("has Handoff phase prompts mentioning GitHub", async () => {
    const { githubKit } = await import("../kits/github-kit.js");
    const handoffPrompts = githubKit.phasePrompts?.[Phase.Handoff] ?? [];
    const hasGitHub = handoffPrompts.some((p) =>
      p.toLowerCase().includes("github")
    );
    expect(hasGitHub).toBe(true);
  });

  it("has Generate phase prompts mentioning OIDC", async () => {
    const { githubKit } = await import("../kits/github-kit.js");
    const generatePrompts = githubKit.phasePrompts?.[Phase.Generate] ?? [];
    const hasOIDC = generatePrompts.some((p) =>
      p.toLowerCase().includes("oidc")
    );
    expect(hasOIDC).toBe(true);
  });
});

// ── Skill type (#33) ────────────────────────────────────────────────────────

describe("resolveSkills — typed Skill objects", () => {
  it("injects skill content for matching phase", () => {
    const skill = makeSkill("test-skill", {
      phases: [Phase.Generate],
      content: "Generate Bicep modules",
    });
    const kit = makeKit("skill-kit", { skills: [skill] });

    const result = resolveSkills(Phase.Generate, [kit]);
    expect(result.prompts.some((p) => p.includes("Generate Bicep modules"))).toBe(true);
  });

  it("does not inject skill content for non-matching phase", () => {
    const skill = makeSkill("gen-only", {
      phases: [Phase.Generate],
      content: "Generate-only content",
    });
    const kit = makeKit("skill-kit", { skills: [skill] });

    const result = resolveSkills(Phase.Discover, [kit]);
    expect(result.prompts.some((p) => p.includes("Generate-only content"))).toBe(false);
  });

  it("respects priority — higher priority skills appear first", () => {
    const lowPriority = makeSkill("low", {
      phases: [Phase.Generate],
      content: "LOW_PRIORITY_CONTENT",
      priority: 1,
    });
    const highPriority = makeSkill("high", {
      phases: [Phase.Generate],
      content: "HIGH_PRIORITY_CONTENT",
      priority: 10,
    });
    const kit = makeKit("priority-kit", { skills: [lowPriority, highPriority] });

    const result = resolveSkills(Phase.Generate, [kit]);
    const highIdx = result.prompts.findIndex((p) => p.includes("HIGH_PRIORITY_CONTENT"));
    const lowIdx = result.prompts.findIndex((p) => p.includes("LOW_PRIORITY_CONTENT"));
    expect(highIdx).toBeLessThan(lowIdx);
  });

  it("skills coexist with phasePrompts", () => {
    const skill = makeSkill("coexist", {
      phases: [Phase.Generate],
      content: "Skill content here",
    });
    const kit = makeKit("mixed-kit", {
      skills: [skill],
      phasePrompts: { [Phase.Generate]: ["Legacy phase prompt"] },
    });

    const result = resolveSkills(Phase.Generate, [kit]);
    expect(result.prompts.some((p) => p.includes("Skill content here"))).toBe(true);
    expect(result.prompts.some((p) => p.includes("Legacy phase prompt"))).toBe(true);
  });
});

// ── resolveSkillsFromList ────────────────────────────────────────────────────

describe("resolveSkillsFromList", () => {
  it("resolves skills from a flat list", () => {
    const skills: Skill[] = [
      makeSkill("direct-a", { phases: [Phase.Generate], content: "Direct A" }),
      makeSkill("direct-b", { phases: [Phase.Review], content: "Direct B" }),
    ];

    const genResult = resolveSkillsFromList(Phase.Generate, skills);
    expect(genResult.prompts.some((p) => p.includes("Direct A"))).toBe(true);
    expect(genResult.prompts.some((p) => p.includes("Direct B"))).toBe(false);

    const revResult = resolveSkillsFromList(Phase.Review, skills);
    expect(revResult.prompts.some((p) => p.includes("Direct B"))).toBe(true);
  });
});

// ── resolveSkillsAsync ───────────────────────────────────────────────────────

describe("resolveSkillsAsync", () => {
  it("returns same results as sync version", async () => {
    const skill = makeSkill("async-test", {
      phases: [Phase.Generate],
      content: "Async skill content",
    });
    const kit = makeKit("async-kit", { skills: [skill] });

    const syncResult = resolveSkills(Phase.Generate, [kit]);
    const asyncResult = await resolveSkillsAsync(Phase.Generate, [kit]);

    expect(asyncResult.prompts).toEqual(syncResult.prompts);
    expect(asyncResult.availableTools).toEqual(syncResult.availableTools);
  });
});

// ── IaC Best Practices (#21) ────────────────────────────────────────────────

describe("azureKit IaC skills (#21)", () => {
  it("has skills array defined", async () => {
    const { azureKit } = await import("../kits/azure-kit.js");
    expect(azureKit.skills).toBeDefined();
    expect(azureKit.skills!.length).toBeGreaterThanOrEqual(5);
  });

  it("includes Bicep module conventions skill for Generate phase", async () => {
    const { azureKit } = await import("../kits/azure-kit.js");
    const result = resolveSkills(Phase.Generate, [azureKit]);
    const hasBicep = result.prompts.some((p) =>
      p.includes("Bicep Module Structure Conventions")
    );
    expect(hasBicep).toBe(true);
  });

  it("includes @secure() decorator skill for Generate and Review", async () => {
    const { azureKit } = await import("../kits/azure-kit.js");

    for (const phase of [Phase.Generate, Phase.Review]) {
      const result = resolveSkills(phase, [azureKit]);
      const hasSecure = result.prompts.some((p) =>
        p.includes("@secure()") && p.includes("Secret Handling")
      );
      expect(hasSecure).toBe(true);
    }
  });

  it("includes diagnostic settings skill for Generate phase", async () => {
    const { azureKit } = await import("../kits/azure-kit.js");
    const result = resolveSkills(Phase.Generate, [azureKit]);
    const hasDiag = result.prompts.some((p) =>
      p.includes("Diagnostic Settings")
    );
    expect(hasDiag).toBe(true);
  });

  it("includes resource tagging skill for Generate phase", async () => {
    const { azureKit } = await import("../kits/azure-kit.js");
    const result = resolveSkills(Phase.Generate, [azureKit]);
    const hasTags = result.prompts.some((p) =>
      p.includes("Resource Tagging Strategy")
    );
    expect(hasTags).toBe(true);
  });

  it("includes least-privilege RBAC skill (Zapp requirement)", async () => {
    const { azureKit } = await import("../kits/azure-kit.js");
    const result = resolveSkills(Phase.Generate, [azureKit]);
    const hasRbac = result.prompts.some((p) =>
      p.includes("Least-Privilege RBAC")
    );
    expect(hasRbac).toBe(true);
  });

  it("@secure() skill contains no-secret-output instruction (Zapp requirement)", async () => {
    const { azureKit } = await import("../kits/azure-kit.js");
    const secureSkill = azureKit.skills!.find((s) => s.id === "iac-secure-decorators");
    expect(secureSkill).toBeDefined();
    expect(secureSkill!.content).toContain("NEVER generate Bicep");
    expect(secureSkill!.content).toContain("output");
    expect(secureSkill!.content).toContain("secret");
  });

  it("RBAC skill enforces least-privilege and managed identity (Zapp requirement)", async () => {
    const { azureKit } = await import("../kits/azure-kit.js");
    const rbacSkill = azureKit.skills!.find((s) => s.id === "iac-least-privilege-rbac");
    expect(rbacSkill).toBeDefined();
    expect(rbacSkill!.content).toContain("narrowest resource possible");
    expect(rbacSkill!.content).toContain("NEVER assign Owner");
    expect(rbacSkill!.content).toContain("Managed Identity");
  });

  it("IaC skills are not injected in Discover phase", async () => {
    const { azureKit } = await import("../kits/azure-kit.js");
    const result = resolveSkills(Phase.Discover, [azureKit]);
    const hasIac = result.prompts.some((p) =>
      p.includes("Bicep Module") || p.includes("Least-Privilege RBAC")
    );
    expect(hasIac).toBe(false);
  });
});
