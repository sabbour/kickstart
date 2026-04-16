/**
 * Tests for dynamic A2UI component catalog injection (Issue #185).
 *
 * Verifies:
 *   - Base catalog generates all 28 component entries
 *   - Kit-contributed components appear in the generated section
 *   - Kit entries override base entries of the same type (dedup)
 *   - Component count updates dynamically
 *   - buildSystemPrompt injects the catalog via the placeholder
 *   - IntegrationKitRegistry.getComponentCatalogEntries() works
 *   - Backward-compatible: no kit entries means base 28 components appear
 */

import { describe, it, expect } from "vitest";
import {
  generateComponentCatalogSection,
  BASE_COMPONENT_CATALOG,
} from "../prompts/component-catalog.js";
import type { ComponentCatalogEntry } from "../prompts/component-catalog.js";
import { buildSystemPrompt } from "../prompts/system-prompt.js";
import { Phase } from "../engine/types.js";
import { IntegrationKitRegistry } from "../kits/registry.js";
import { ToolRegistry } from "../tools/registry.js";
import { APIConnectorRegistry } from "../connectors/registry.js";
import type { IntegrationKit } from "../kits/types.js";

// ---------------------------------------------------------------------------
// generateComponentCatalogSection
// ---------------------------------------------------------------------------

describe("generateComponentCatalogSection", () => {
  it("generates all 28 base components", () => {
    const section = generateComponentCatalogSection();
    expect(section).toContain("You have 28 components");
  });

  it("includes all four category headings", () => {
    const section = generateComponentCatalogSection();
    expect(section).toContain("### Layout Components");
    expect(section).toContain("### Content Components");
    expect(section).toContain("### Input Components");
    expect(section).toContain("### Kickstart Domain Components");
  });

  it("includes specific component entries from each category", () => {
    const section = generateComponentCatalogSection();
    expect(section).toContain("- Row:");
    expect(section).toContain("- Accordion:");
    expect(section).toContain("- Text:");
    expect(section).toContain("- Badge:");
    expect(section).toContain("- Button:");
    expect(section).toContain("- ChoicePicker:");
    expect(section).toContain("- CostEstimate:");
    expect(section).toContain("- GenerationProgress:");
  });

  it("includes notes for components that have them", () => {
    const section = generateComponentCatalogSection();
    expect(section).toContain("variants: h1, h2, h3, body, caption, code");
    expect(section).toContain("Variants: primary, secondary, outline, danger, ghost");
    expect(section).toContain("Prefer the `diagram` prop (raw Mermaid) over `nodes/edges`");
  });

  it("merges kit entries and updates component count", () => {
    const kitEntries: ComponentCatalogEntry[] = [
      {
        type: "AzureResourcePicker",
        category: "domain",
        example: '{"id":"arp1","component":"AzureResourcePicker","resourceType":"Microsoft.Web/sites"}',
        notes: "Picks Azure resources",
      },
    ];
    const section = generateComponentCatalogSection(BASE_COMPONENT_CATALOG, kitEntries);
    expect(section).toContain("You have 29 components");
    expect(section).toContain("- AzureResourcePicker:");
    expect(section).toContain("Picks Azure resources");
  });

  it("kit entry overrides base entry with same type", () => {
    const kitEntries: ComponentCatalogEntry[] = [
      {
        type: "Text",
        category: "content",
        example: '{"id":"t1","component":"Text","text":"Custom","variant":"h1"}',
        notes: "customized by kit",
      },
    ];
    const section = generateComponentCatalogSection(BASE_COMPONENT_CATALOG, kitEntries);
    expect(section).toContain("You have 28 components");
    expect(section).toContain("customized by kit");
  });

  it("handles empty base catalog with only kit entries", () => {
    const kitEntries: ComponentCatalogEntry[] = [
      {
        type: "CustomWidget",
        category: "domain",
        example: '{"id":"cw1","component":"CustomWidget","data":"test"}',
      },
    ];
    const section = generateComponentCatalogSection([], kitEntries);
    expect(section).toContain("You have 1 components");
    expect(section).toContain("- CustomWidget:");
  });

  it("preserves JSON examples exactly as provided", () => {
    const section = generateComponentCatalogSection();
    expect(section).toContain('{"id":"div1","component":"Divider"}');
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt -- dynamic catalog injection
// ---------------------------------------------------------------------------

describe("buildSystemPrompt with dynamic component catalog", () => {
  it("includes the dynamically generated catalog in the prompt", () => {
    const prompt = buildSystemPrompt({ phase: Phase.Discover });
    expect(prompt).toContain("## 5. A2UI COMPONENT CATALOG");
    expect(prompt).toContain("You have 28 components");
    expect(prompt).toContain("### Layout Components");
  });

  it("does NOT contain the placeholder in output", () => {
    const prompt = buildSystemPrompt({ phase: Phase.Discover });
    expect(prompt).not.toContain("{{componentCatalog}}");
  });

  it("includes kit-contributed components when kitComponentEntries provided", () => {
    const prompt = buildSystemPrompt({
      phase: Phase.Discover,
      kitComponentEntries: [
        {
          type: "GitHubRepoPicker",
          category: "domain",
          example: '{"id":"ghp1","component":"GitHubRepoPicker","owner":"user"}',
        },
      ],
    });
    expect(prompt).toContain("You have 29 components");
    expect(prompt).toContain("- GitHubRepoPicker:");
  });

  it("backward-compatible: no kitComponentEntries means base 28 appear", () => {
    const prompt = buildSystemPrompt({ phase: Phase.Design });
    expect(prompt).toContain("You have 28 components");
    expect(prompt).toContain("- Row:");
    expect(prompt).toContain("- GenerationProgress:");
  });
});

// ---------------------------------------------------------------------------
// IntegrationKitRegistry.getComponentCatalogEntries()
// ---------------------------------------------------------------------------

describe("IntegrationKitRegistry.getComponentCatalogEntries", () => {
  function makeIsolatedRegistry() {
    const toolRegistry = new ToolRegistry();
    const connectorRegistry = new APIConnectorRegistry();
    return new IntegrationKitRegistry(toolRegistry, connectorRegistry);
  }

  it("returns empty array when no kits are registered", () => {
    const registry = makeIsolatedRegistry();
    expect(registry.getComponentCatalogEntries()).toEqual([]);
  });

  it("returns empty array when kit has no promptMeta", async () => {
    const registry = makeIsolatedRegistry();
    const kit: IntegrationKit = {
      name: "test-kit",
      description: "test",
      tools: [],
      connectors: [],
      components: [
        { type: "TestComp", description: "A test component" },
      ],
    };
    await registry.register(kit);
    expect(registry.getComponentCatalogEntries()).toEqual([]);
  });

  it("returns catalog entries from kit components with promptMeta", async () => {
    const registry = makeIsolatedRegistry();
    const kit: IntegrationKit = {
      name: "azure-kit-test",
      description: "test azure kit",
      tools: [],
      connectors: [],
      components: [
        {
          type: "AzureLoginCard",
          description: "Azure login component",
          promptMeta: {
            category: "domain",
            example: '{"id":"alc1","component":"AzureLoginCard","tenant":"contoso.com"}',
            notes: "Triggers Azure MSAL login flow",
          },
        },
        {
          type: "AzureResourceForm",
          description: "Azure resource form",
        },
      ],
    };
    await registry.register(kit);
    const entries = registry.getComponentCatalogEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("AzureLoginCard");
    expect(entries[0].category).toBe("domain");
    expect(entries[0].notes).toBe("Triggers Azure MSAL login flow");
  });

  it("collects entries from multiple kits", async () => {
    const registry = makeIsolatedRegistry();
    const kit1: IntegrationKit = {
      name: "kit-a",
      description: "kit A",
      tools: [],
      connectors: [],
      components: [
        {
          type: "CompA",
          description: "Component A",
          promptMeta: {
            category: "input",
            example: '{"id":"a1","component":"CompA"}',
          },
        },
      ],
    };
    const kit2: IntegrationKit = {
      name: "kit-b",
      description: "kit B",
      tools: [],
      connectors: [],
      components: [
        {
          type: "CompB",
          description: "Component B",
          promptMeta: {
            category: "content",
            example: '{"id":"b1","component":"CompB"}',
          },
        },
      ],
    };
    await registry.register(kit1);
    await registry.register(kit2);
    const entries = registry.getComponentCatalogEntries();
    expect(entries).toHaveLength(2);
    const types = entries.map((e) => e.type);
    expect(types).toContain("CompA");
    expect(types).toContain("CompB");
  });
});

// ---------------------------------------------------------------------------
// BASE_COMPONENT_CATALOG integrity
// ---------------------------------------------------------------------------

describe("BASE_COMPONENT_CATALOG", () => {
  it("has exactly 28 entries", () => {
    expect(BASE_COMPONENT_CATALOG).toHaveLength(28);
  });

  it("has unique type names", () => {
    const types = BASE_COMPONENT_CATALOG.map((e) => e.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("every entry has valid JSON in its example", () => {
    for (const entry of BASE_COMPONENT_CATALOG) {
      expect(() => JSON.parse(entry.example)).not.toThrow();
    }
  });

  it("every example includes the matching component type", () => {
    for (const entry of BASE_COMPONENT_CATALOG) {
      const parsed = JSON.parse(entry.example);
      expect(parsed.component).toBe(entry.type);
    }
  });
});
