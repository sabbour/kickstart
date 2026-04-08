import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const catalogPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/catalog/kickstart-catalog.json",
);

function loadCatalog(): Record<string, unknown> {
  const raw = readFileSync(catalogPath, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

describe("catalog JSON validity", () => {
  it("can be parsed as valid JSON", () => {
    expect(() => loadCatalog()).not.toThrow();
  });
});

describe("catalog metadata", () => {
  it('has version "0.9"', () => {
    const catalog = loadCatalog();
    const properties = catalog["properties"] as Record<string, unknown>;
    const version = properties["version"] as Record<string, unknown>;
    expect(version["const"]).toBe("0.9");
  });
});

describe("component definitions", () => {
  const expectedComponents = [
    "Text",
    "Button",
    "TextField",
    "Row",
    "Column",
    "Card",
    "ConversationPhase",
    "CodeBlock",
    "ResourcePicker",
    "DeploymentProgress",
    "ArchitectureDiagram",
    "CostEstimate",
    "HandoffCard",
    "RepoPicker",
    "WorkflowStatus",
    "CodespaceLink",
    "AppOverview",
  ];

  it("all expected component types exist in the oneOf union", () => {
    const catalog = loadCatalog();
    const defs = catalog["$defs"] as Record<string, unknown>;
    const component = defs["Component"] as Record<string, unknown>;
    const oneOf = component["oneOf"] as Array<{ $ref: string }>;
    const componentNames = oneOf.map((ref) =>
      ref["$ref"].replace("#/$defs/", ""),
    );

    for (const name of expectedComponents) {
      expect(componentNames).toContain(name);
    }
  });

  it("all expected component types are defined in $defs", () => {
    const catalog = loadCatalog();
    const defs = catalog["$defs"] as Record<string, unknown>;

    for (const name of expectedComponents) {
      expect(defs).toHaveProperty(name);
    }
  });

  it('each component definition has required "type" property', () => {
    const catalog = loadCatalog();
    const defs = catalog["$defs"] as Record<string, Record<string, unknown>>;

    for (const name of expectedComponents) {
      const def = defs[name];
      // Components use allOf with BaseComponent which has "type" required
      const allOf = def["allOf"] as Array<Record<string, unknown>>;
      expect(allOf).toBeDefined();

      // The second entry in allOf has the component-specific properties
      const specific = allOf[1] as Record<string, unknown>;
      const props = specific["properties"] as Record<string, unknown>;
      expect(props).toHaveProperty("type");
    }
  });
});

describe("custom Kickstart components", () => {
  it("ArchitectureDiagram has mermaid property", () => {
    const catalog = loadCatalog();
    const defs = catalog["$defs"] as Record<string, Record<string, unknown>>;
    const allOf = defs["ArchitectureDiagram"]["allOf"] as Array<
      Record<string, unknown>
    >;
    const props = (allOf[1] as Record<string, unknown>)[
      "properties"
    ] as Record<string, unknown>;
    expect(props).toHaveProperty("mermaid");
  });

  it("CostEstimate has items, total, and currency", () => {
    const catalog = loadCatalog();
    const defs = catalog["$defs"] as Record<string, Record<string, unknown>>;
    const allOf = defs["CostEstimate"]["allOf"] as Array<
      Record<string, unknown>
    >;
    const props = (allOf[1] as Record<string, unknown>)[
      "properties"
    ] as Record<string, unknown>;
    expect(props).toHaveProperty("items");
    expect(props).toHaveProperty("total");
    expect(props).toHaveProperty("currency");
  });

  it("HandoffCard has url, provider, and repoUrl", () => {
    const catalog = loadCatalog();
    const defs = catalog["$defs"] as Record<string, Record<string, unknown>>;
    const allOf = defs["HandoffCard"]["allOf"] as Array<
      Record<string, unknown>
    >;
    const props = (allOf[1] as Record<string, unknown>)[
      "properties"
    ] as Record<string, unknown>;
    expect(props).toHaveProperty("url");
    expect(props).toHaveProperty("provider");
    expect(props).toHaveProperty("repoUrl");
  });

  it("AppOverview has appName, runtime, services, and status", () => {
    const catalog = loadCatalog();
    const defs = catalog["$defs"] as Record<string, Record<string, unknown>>;
    const allOf = defs["AppOverview"]["allOf"] as Array<
      Record<string, unknown>
    >;
    const props = (allOf[1] as Record<string, unknown>)[
      "properties"
    ] as Record<string, unknown>;
    expect(props).toHaveProperty("appName");
    expect(props).toHaveProperty("runtime");
    expect(props).toHaveProperty("services");
    expect(props).toHaveProperty("status");
  });

  it("ResourcePicker has resourceType property", () => {
    const catalog = loadCatalog();
    const defs = catalog["$defs"] as Record<string, Record<string, unknown>>;
    const allOf = defs["ResourcePicker"]["allOf"] as Array<
      Record<string, unknown>
    >;
    const props = (allOf[1] as Record<string, unknown>)[
      "properties"
    ] as Record<string, unknown>;
    expect(props).toHaveProperty("resourceType");
  });

  it("DeploymentProgress has steps and overallStatus", () => {
    const catalog = loadCatalog();
    const defs = catalog["$defs"] as Record<string, Record<string, unknown>>;
    const allOf = defs["DeploymentProgress"]["allOf"] as Array<
      Record<string, unknown>
    >;
    const props = (allOf[1] as Record<string, unknown>)[
      "properties"
    ] as Record<string, unknown>;
    expect(props).toHaveProperty("steps");
    expect(props).toHaveProperty("overallStatus");
  });
});
