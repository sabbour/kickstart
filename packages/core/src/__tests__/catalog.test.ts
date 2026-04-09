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
  // 18 basic + 5 custom = 23 components
  const basicComponents = [
    "Text",
    "Image",
    "Icon",
    "Video",
    "AudioPlayer",
    "Row",
    "Column",
    "List",
    "Card",
    "Tabs",
    "Divider",
    "Modal",
    "Button",
    "TextField",
    "CheckBox",
    "ChoicePicker",
    "Slider",
    "DateTimeInput",
  ];

  const customComponents = [
    "CostEstimate",
    "ArchitectureDiagram",
    "FileEditor",
    "AuthCard",
    "DeploymentProgress",
  ];

  const expectedComponents = [...basicComponents, ...customComponents];

  it("has 18 basic components", () => {
    expect(basicComponents).toHaveLength(18);
  });

  it("has 5 custom Kickstart components", () => {
    expect(customComponents).toHaveLength(5);
  });

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

  it('each component definition has required "component" property (v0.9 format)', () => {
    const catalog = loadCatalog();
    const defs = catalog["$defs"] as Record<string, Record<string, unknown>>;

    for (const name of expectedComponents) {
      const def = defs[name];
      const allOf = def["allOf"] as Array<Record<string, unknown>>;
      expect(allOf).toBeDefined();

      const specific = allOf[1] as Record<string, unknown>;
      const props = specific["properties"] as Record<string, unknown>;
      expect(props).toHaveProperty("component");
    }
  });
});

describe("custom Kickstart components", () => {
  it("ArchitectureDiagram has nodes and edges properties", () => {
    const catalog = loadCatalog();
    const defs = catalog["$defs"] as Record<string, Record<string, unknown>>;
    const allOf = defs["ArchitectureDiagram"]["allOf"] as Array<
      Record<string, unknown>
    >;
    const props = (allOf[1] as Record<string, unknown>)[
      "properties"
    ] as Record<string, unknown>;
    expect(props).toHaveProperty("nodes");
    expect(props).toHaveProperty("edges");
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

  it("FileEditor has filename, language, and content", () => {
    const catalog = loadCatalog();
    const defs = catalog["$defs"] as Record<string, Record<string, unknown>>;
    const allOf = defs["FileEditor"]["allOf"] as Array<
      Record<string, unknown>
    >;
    const props = (allOf[1] as Record<string, unknown>)[
      "properties"
    ] as Record<string, unknown>;
    expect(props).toHaveProperty("filename");
    expect(props).toHaveProperty("language");
    expect(props).toHaveProperty("content");
  });

  it("AuthCard has provider and title", () => {
    const catalog = loadCatalog();
    const defs = catalog["$defs"] as Record<string, Record<string, unknown>>;
    const allOf = defs["AuthCard"]["allOf"] as Array<
      Record<string, unknown>
    >;
    const props = (allOf[1] as Record<string, unknown>)[
      "properties"
    ] as Record<string, unknown>;
    expect(props).toHaveProperty("provider");
    expect(props).toHaveProperty("title");
  });

  it("DeploymentProgress has steps", () => {
    const catalog = loadCatalog();
    const defs = catalog["$defs"] as Record<string, Record<string, unknown>>;
    const allOf = defs["DeploymentProgress"]["allOf"] as Array<
      Record<string, unknown>
    >;
    const props = (allOf[1] as Record<string, unknown>)[
      "properties"
    ] as Record<string, unknown>;
    expect(props).toHaveProperty("steps");
  });
});
