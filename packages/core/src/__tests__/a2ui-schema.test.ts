import { describe, it, expect } from "vitest";
import {
  A2UIMessageSchema,
  ActionSchema,
  COMPONENT_SCHEMA_REGISTRY,
  KNOWN_COMPONENT_TYPES,
  PAYLOAD_LIMITS,
  checkDepth,
} from "../services/a2ui-schema.js";

// ---------------------------------------------------------------------------
// checkDepth
// ---------------------------------------------------------------------------

describe("checkDepth", () => {
  it("returns true for flat values", () => {
    expect(checkDepth("hello", 10)).toBe(true);
    expect(checkDepth(42, 10)).toBe(true);
    expect(checkDepth(null, 10)).toBe(true);
    expect(checkDepth(true, 10)).toBe(true);
  });

  it("returns true when within depth limit", () => {
    expect(checkDepth({ a: { b: { c: 1 } } }, 3)).toBe(true);
  });

  it("returns false when exceeding depth limit", () => {
    expect(checkDepth({ a: { b: { c: { d: 1 } } } }, 2)).toBe(false);
  });

  it("handles arrays within depth check", () => {
    expect(checkDepth({ a: [{ b: 1 }] }, 3)).toBe(true);
    expect(checkDepth({ a: [{ b: { c: { d: { e: 1 } } } }] }, 3)).toBe(false);
  });

  it("returns true for empty objects", () => {
    expect(checkDepth({}, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PAYLOAD_LIMITS
// ---------------------------------------------------------------------------

describe("PAYLOAD_LIMITS", () => {
  it("has expected default values", () => {
    expect(PAYLOAD_LIMITS.maxMessages).toBe(50);
    expect(PAYLOAD_LIMITS.maxComponents).toBe(200);
    expect(PAYLOAD_LIMITS.maxPayloadBytes).toBe(512 * 1024);
    expect(PAYLOAD_LIMITS.maxNestingDepth).toBe(10);
    expect(PAYLOAD_LIMITS.maxStringLength).toBe(50_000);
    expect(PAYLOAD_LIMITS.maxActions).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// KNOWN_COMPONENT_TYPES
// ---------------------------------------------------------------------------

describe("KNOWN_COMPONENT_TYPES", () => {
  it("contains exactly 28 types", () => {
    expect(KNOWN_COMPONENT_TYPES.size).toBe(28);
  });

  it("includes all expected component types", () => {
    const expected = [
      "Accordion", "ArchitectureDiagram", "AudioPlayer", "AuthCard",
      "Badge", "Button", "Card", "CheckBox", "ChoicePicker", "Column",
      "ComboBox", "CostEstimate", "DateTimeInput", "DeploymentProgress",
      "Divider", "FileEditor", "Icon", "Image", "List", "Modal",
      "MultiSelect", "Row", "Slider", "Tabs", "Text", "TextField",
      "Toggle", "Video",
    ];
    for (const t of expected) {
      expect(KNOWN_COMPONENT_TYPES.has(t as never)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// COMPONENT_SCHEMA_REGISTRY
// ---------------------------------------------------------------------------

describe("COMPONENT_SCHEMA_REGISTRY", () => {
  it("has a schema for every known component type", () => {
    for (const t of KNOWN_COMPONENT_TYPES) {
      expect(COMPONENT_SCHEMA_REGISTRY[t]).toBeDefined();
    }
  });

  it("validates a Text component", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["Text"].safeParse({
      id: "t1",
      component: "Text",
      text: "Hello",
      variant: "h1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a Text component missing required text", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["Text"].safeParse({
      id: "t1",
      component: "Text",
    });
    expect(result.success).toBe(false);
  });

  it("strips unknown props from a Text component", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["Text"].safeParse({
      id: "t1",
      component: "Text",
      text: "Hi",
      unknownField: "should be removed",
    });
    expect(result.success).toBe(true);
    expect((result as { success: true; data: Record<string, unknown> }).data).not.toHaveProperty("unknownField");
  });

  it("validates a Button component with action", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["Button"].safeParse({
      id: "btn1",
      component: "Button",
      child: "label-id",
      variant: "primary",
      action: { event: { name: "click" } },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a Button without required action", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["Button"].safeParse({
      id: "btn1",
      component: "Button",
      child: "label-id",
    });
    expect(result.success).toBe(false);
  });

  it("validates ChoicePicker with options", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["ChoicePicker"].safeParse({
      id: "cp1",
      component: "ChoicePicker",
      label: "Pick one",
      options: [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("validates ArchitectureDiagram with nodes and edges", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["ArchitectureDiagram"].safeParse({
      id: "arch1",
      component: "ArchitectureDiagram",
      nodes: [
        { id: "api", label: "API", type: "compute" },
        { id: "db", label: "DB", type: "database" },
      ],
      edges: [{ from: "api", to: "db" }],
    });
    expect(result.success).toBe(true);
  });

  it("validates CostEstimate with items", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["CostEstimate"].safeParse({
      id: "cost1",
      component: "CostEstimate",
      items: [{ name: "VM", sku: "B1ms", monthlyCost: 12.40 }],
      total: 12.40,
      currency: "USD",
    });
    expect(result.success).toBe(true);
  });

  it("validates Divider (minimal component)", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["Divider"].safeParse({
      id: "div1",
      component: "Divider",
    });
    expect(result.success).toBe(true);
  });

  it("validates Badge with optional props", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["Badge"].safeParse({
      id: "b1",
      component: "Badge",
      text: "New",
      color: "success",
      shape: "rounded",
    });
    expect(result.success).toBe(true);
  });

  it("validates Accordion with items", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["Accordion"].safeParse({
      id: "acc1",
      component: "Accordion",
      items: [{ title: "Section 1", children: ["child1"] }],
    });
    expect(result.success).toBe(true);
  });

  it("validates AuthCard", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["AuthCard"].safeParse({
      id: "auth1",
      component: "AuthCard",
      provider: "azure",
      title: "Sign in",
    });
    expect(result.success).toBe(true);
  });

  it("validates DeploymentProgress", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["DeploymentProgress"].safeParse({
      id: "dp1",
      component: "DeploymentProgress",
      steps: [
        { id: "s1", label: "Build", status: "complete" },
        { id: "s2", label: "Deploy", status: "running" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("validates FileEditor", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["FileEditor"].safeParse({
      id: "fe1",
      component: "FileEditor",
      filename: "Dockerfile",
      language: "dockerfile",
      content: "FROM node:20",
    });
    expect(result.success).toBe(true);
  });

  it("accepts dynamic string (object) for Text.text", () => {
    const result = COMPONENT_SCHEMA_REGISTRY["Text"].safeParse({
      id: "t1",
      component: "Text",
      text: { "@dataPath": "/app/name" },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// A2UIMessageSchema
// ---------------------------------------------------------------------------

describe("A2UIMessageSchema", () => {
  it("validates createSurface message", () => {
    const result = A2UIMessageSchema.safeParse({
      type: "createSurface",
      surfaceId: "msg-1",
      catalogId: "kickstart",
    });
    expect(result.success).toBe(true);
  });

  it("validates updateComponents message", () => {
    const result = A2UIMessageSchema.safeParse({
      type: "updateComponents",
      surfaceId: "msg-1",
      components: [
        { id: "t1", component: "Text", text: "Hi" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("validates updateDataModel message", () => {
    const result = A2UIMessageSchema.safeParse({
      type: "updateDataModel",
      surfaceId: "msg-1",
      path: "/app/name",
      value: "my-app",
    });
    expect(result.success).toBe(true);
  });

  it("validates deleteSurface message", () => {
    const result = A2UIMessageSchema.safeParse({
      type: "deleteSurface",
      surfaceId: "msg-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown message type", () => {
    const result = A2UIMessageSchema.safeParse({
      type: "destroySurface",
      surfaceId: "msg-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty surfaceId", () => {
    const result = A2UIMessageSchema.safeParse({
      type: "createSurface",
      surfaceId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects updateDataModel with invalid path (no leading /)", () => {
    const result = A2UIMessageSchema.safeParse({
      type: "updateDataModel",
      surfaceId: "msg-1",
      path: "app/name",
      value: "x",
    });
    expect(result.success).toBe(false);
  });

  it("strips unknown fields from createSurface", () => {
    const result = A2UIMessageSchema.safeParse({
      type: "createSurface",
      surfaceId: "msg-1",
      unknownField: "bad",
    });
    expect(result.success).toBe(true);
    expect((result as { success: true; data: Record<string, unknown> }).data).not.toHaveProperty("unknownField");
  });

  it("truncates oversized strings instead of rejecting", () => {
    const longText = "a".repeat(PAYLOAD_LIMITS.maxStringLength + 100);
    const result = A2UIMessageSchema.safeParse({
      type: "createSurface",
      surfaceId: "msg-1",
      catalogId: longText,
    });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> }).data;
    expect((data.catalogId as string).length).toBe(PAYLOAD_LIMITS.maxStringLength);
  });

  it("trims components array to maxComponents instead of rejecting", () => {
    const components = Array.from({ length: PAYLOAD_LIMITS.maxComponents + 50 }, (_, i) => ({
      id: `c-${i}`,
      component: "Text",
      text: `Item ${i}`,
    }));
    const result = A2UIMessageSchema.safeParse({
      type: "updateComponents",
      surfaceId: "msg-1",
      components,
    });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: { components: unknown[] } }).data;
    expect(data.components).toHaveLength(PAYLOAD_LIMITS.maxComponents);
  });
});

// ---------------------------------------------------------------------------
// ActionSchema
// ---------------------------------------------------------------------------

describe("ActionSchema", () => {
  it("validates an action with type", () => {
    const result = ActionSchema.safeParse({ type: "navigate", url: "/home" });
    expect(result.success).toBe(true);
  });

  it("rejects action without type", () => {
    const result = ActionSchema.safeParse({ url: "/home" });
    expect(result.success).toBe(false);
  });

  it("rejects action with empty type", () => {
    const result = ActionSchema.safeParse({ type: "" });
    expect(result.success).toBe(false);
  });
});
