import { describe, it, expect } from "vitest";
import {
  resolveA2UICapability,
  createA2UIResource,
  createA2UIDocument,
  degradeToBasic,
  A2UI_MIME_TYPE,
  KICKSTART_CATALOG_ID,
} from "../a2ui.js";
import type { A2UICapability as _A2UICapability } from "../a2ui.js";
import type { AppComponent as Component, TextComponent, CardComponent } from "../a2ui.js";

// ── resolveA2UICapability ───────────────────────────────────────────

describe("resolveA2UICapability", () => {
  it('returns "kickstart" when client declares the kickstart catalog', () => {
    const result = resolveA2UICapability([KICKSTART_CATALOG_ID]);
    expect(result).toBe("kickstart");
  });

  it('returns "kickstart" even when other catalogs are also listed', () => {
    const result = resolveA2UICapability([
      "https://example.com/some-other-catalog.json",
      KICKSTART_CATALOG_ID,
    ]);
    expect(result).toBe("kickstart");
  });

  it('returns "basic" when client declares a catalog that is NOT kickstart', () => {
    const result = resolveA2UICapability([
      "https://example.com/basic_catalog.json",
    ]);
    expect(result).toBe("basic");
  });

  it('returns "none" when client declares no catalogs (empty array)', () => {
    const result = resolveA2UICapability([]);
    expect(result).toBe("none");
  });

  it('returns "none" when clientCatalogs is undefined', () => {
    const result = resolveA2UICapability(undefined);
    expect(result).toBe("none");
  });
});

// ── createA2UIDocument ──────────────────────────────────────────────

describe("createA2UIDocument", () => {
  it("wraps a component into a document with version 0.9", () => {
    const component: TextComponent = {
      type: "Text",
      id: "test-text",
      content: "Hello",
    };
    const doc = createA2UIDocument(component);
    expect(doc.version).toBe("0.9");
    expect(doc.root).toBe(component);
  });
});

// ── degradeToBasic ──────────────────────────────────────────────────

describe("degradeToBasic", () => {
  it("wraps a custom component in a Card with a Text child", () => {
    const custom: Component = {
      type: "ConversationPhase",
      id: "phase-indicator",
      phases: [],
      currentPhase: "Discover",
    } as Component;

    const result = degradeToBasic(custom);
    expect(result.type).toBe("Card");
    const card = result as CardComponent;
    expect(card.children).toHaveLength(1);
    expect(card.children![0].type).toBe("Text");
  });

  it("uses the provided title when given", () => {
    const custom: Component = {
      type: "ConversationPhase",
      id: "phase",
    } as Component;

    const result = degradeToBasic(custom, "My Title") as CardComponent;
    expect(result.title).toBe("My Title");
  });

  it("falls back to component type as title when no title provided", () => {
    const custom: Component = {
      type: "ConversationPhase",
      id: "phase",
    } as Component;

    const result = degradeToBasic(custom) as CardComponent;
    expect(result.title).toBe("ConversationPhase");
  });
});

// ── createA2UIResource ──────────────────────────────────────────────

describe("createA2UIResource", () => {
  const sampleComponent: TextComponent = {
    type: "Text",
    id: "sample",
    content: "Hello",
  };
  const sampleUri = "a2ui://kickstart/session/abc-123/phase";

  it('returns a full resource with A2UI MIME type for "kickstart" capability', () => {
    const result = createA2UIResource(sampleComponent, sampleUri, "kickstart");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("resource");
    expect(result!.resource.mimeType).toBe(A2UI_MIME_TYPE);
    expect(result!.resource.mimeType).toBe("application/json+a2ui");
    expect(result!.resource.uri).toBe(sampleUri);

    const doc = JSON.parse(result!.resource.text);
    expect(doc.version).toBe("0.9");
    expect(doc.root.type).toBe("Text");
    expect(doc.root.content).toBe("Hello");
  });

  it('returns a degraded Card resource for "basic" capability', () => {
    const result = createA2UIResource(sampleComponent, sampleUri, "basic");
    expect(result).not.toBeNull();
    expect(result!.resource.mimeType).toBe(A2UI_MIME_TYPE);

    const doc = JSON.parse(result!.resource.text);
    expect(doc.version).toBe("0.9");
    // Basic tier degrades to Card wrapping
    expect(doc.root.type).toBe("Card");
    expect(doc.root.children).toHaveLength(1);
    expect(doc.root.children[0].type).toBe("Text");
  });

  it('returns null for "none" capability (text fallback only)', () => {
    const result = createA2UIResource(sampleComponent, sampleUri, "none");
    expect(result).toBeNull();
  });

  it("defaults to kickstart capability when not specified", () => {
    const result = createA2UIResource(sampleComponent, sampleUri);
    expect(result).not.toBeNull();
    const doc = JSON.parse(result!.resource.text);
    // Should be the original component, not degraded
    expect(doc.root.type).toBe("Text");
  });

  it("preserves the URI format in the resource", () => {
    const uri = "a2ui://kickstart/session/my-session/deployment-status";
    const result = createA2UIResource(sampleComponent, uri, "kickstart");
    expect(result!.resource.uri).toBe(uri);
  });
});
