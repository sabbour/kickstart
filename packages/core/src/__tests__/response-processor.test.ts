import { describe, it, expect } from "vitest";
import { processResponse } from "../services/response-processor.js";
import { PAYLOAD_LIMITS } from "../services/a2ui-schema.js";

describe("processResponse", () => {
  it("parses a valid JSON envelope with message and a2ui", () => {
    const json = JSON.stringify({
      message: "Hello, let me help you deploy your app.",
      a2ui: [
        { type: "createSurface", surfaceId: "msg-1", catalogId: "kickstart" },
        {
          type: "updateComponents",
          surfaceId: "msg-1",
          components: [
            { id: "t1", component: "Text", text: "Welcome", variant: "h1" },
          ],
        },
      ],
      actions: [],
    });

    const result = processResponse(json);
    expect(result.message).toBe("Hello, let me help you deploy your app.");
    expect(result.a2uiMessages).toHaveLength(2);
    expect(result.a2uiMessages[0].type).toBe("createSurface");
    expect(result.a2uiMessages[1].type).toBe("updateComponents");
    expect(result.actions).toHaveLength(0);
    expect(result.raw).toBe(json);
  });

  it("treats invalid JSON as plain text message", () => {
    const raw = "This is not JSON, just plain text from the LLM.";
    const result = processResponse(raw);

    expect(result.message).toBe(raw);
    expect(result.a2uiMessages).toHaveLength(0);
    expect(result.actions).toHaveLength(0);
  });

  it("handles missing a2ui field gracefully", () => {
    const json = JSON.stringify({
      message: "Just a text message.",
    });

    const result = processResponse(json);
    expect(result.message).toBe("Just a text message.");
    expect(result.a2uiMessages).toHaveLength(0);
    expect(result.actions).toHaveLength(0);
  });

  it("handles missing message field gracefully", () => {
    const json = JSON.stringify({
      a2ui: [
        { type: "createSurface", surfaceId: "msg-1", catalogId: "kickstart" },
      ],
      actions: [],
    });

    const result = processResponse(json);
    expect(result.message).toBe("");
    expect(result.a2uiMessages).toHaveLength(1);
  });

  it("skips malformed A2UI messages but keeps valid ones", () => {
    const json = JSON.stringify({
      message: "Mixed bag.",
      a2ui: [
        { type: "createSurface", surfaceId: "msg-1" },
        { type: "invalidType", surfaceId: "msg-1" },
        { type: "updateComponents" }, // missing surfaceId
        "not an object",
        null,
        { type: "updateDataModel", surfaceId: "msg-1", path: "/x", value: 42 },
      ],
      actions: [],
    });

    const result = processResponse(json);
    expect(result.a2uiMessages).toHaveLength(2);
    expect(result.a2uiMessages[0].type).toBe("createSurface");
    expect(result.a2uiMessages[1].type).toBe("updateDataModel");
  });

  it("handles JSON array (not an object) as plain text", () => {
    const json = JSON.stringify([1, 2, 3]);
    const result = processResponse(json);
    expect(result.message).toBe(json.trim());
    expect(result.a2uiMessages).toHaveLength(0);
  });

  it("validates all four A2UI message types", () => {
    const json = JSON.stringify({
      message: "",
      a2ui: [
        { type: "createSurface", surfaceId: "s1" },
        { type: "updateComponents", surfaceId: "s1", components: [] },
        { type: "updateDataModel", surfaceId: "s1", path: "/x", value: "y" },
        { type: "deleteSurface", surfaceId: "s1" },
      ],
      actions: [],
    });

    const result = processResponse(json);
    expect(result.a2uiMessages).toHaveLength(4);
    expect(result.a2uiMessages.map((m) => m.type)).toEqual([
      "createSurface",
      "updateComponents",
      "updateDataModel",
      "deleteSurface",
    ]);
  });

  it("validates actions array", () => {
    const json = JSON.stringify({
      message: "test",
      a2ui: [],
      actions: [
        { type: "navigate", url: "/dashboard" },
        "not an object",
        { noType: true },
        { type: "openModal", target: "settings" },
      ],
    });

    const result = processResponse(json);
    expect(result.actions).toHaveLength(2);
    expect(result.actions[0].type).toBe("navigate");
    expect(result.actions[1].type).toBe("openModal");
  });

  it("handles empty string input", () => {
    const result = processResponse("");
    expect(result.message).toBe("");
    expect(result.a2uiMessages).toHaveLength(0);
  });

  it("preserves raw JSON for debugging", () => {
    const json = '{"message":"test","a2ui":[],"actions":[]}';
    const result = processResponse(json);
    expect(result.raw).toBe(json);
  });

  it("rejects a2ui messages with empty surfaceId", () => {
    const json = JSON.stringify({
      message: "test",
      a2ui: [{ type: "createSurface", surfaceId: "" }],
      actions: [],
    });

    const result = processResponse(json);
    expect(result.a2uiMessages).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Issue #153: Payload limits
  // -----------------------------------------------------------------------

  it("truncates a2ui messages exceeding maxMessages limit", () => {
    const messages = Array.from({ length: 60 }, (_, i) => ({
      type: "createSurface",
      surfaceId: `s-${i}`,
    }));
    const json = JSON.stringify({
      message: "test",
      a2ui: messages,
      actions: [],
    });

    const result = processResponse(json);
    expect(result.a2uiMessages).toHaveLength(PAYLOAD_LIMITS.maxMessages);
  });

  it("truncates actions exceeding maxActions limit", () => {
    const actions = Array.from({ length: 30 }, (_, i) => ({
      type: `action-${i}`,
    }));
    const json = JSON.stringify({
      message: "test",
      a2ui: [],
      actions,
    });

    const result = processResponse(json);
    expect(result.actions).toHaveLength(PAYLOAD_LIMITS.maxActions);
  });

  // -----------------------------------------------------------------------
  // Issue #153: Per-component validation
  // -----------------------------------------------------------------------

  it("rejects unknown component types in updateComponents", () => {
    const json = JSON.stringify({
      message: "test",
      a2ui: [
        {
          type: "updateComponents",
          surfaceId: "s1",
          components: [
            { id: "t1", component: "Text", text: "Valid" },
            { id: "x1", component: "HallucinatedWidget", foo: "bar" },
            { id: "d1", component: "Divider" },
          ],
        },
      ],
      actions: [],
    });

    const result = processResponse(json);
    expect(result.a2uiMessages).toHaveLength(1);
    const comps = (result.a2uiMessages[0] as Record<string, unknown>).components as unknown[];
    expect(comps).toHaveLength(2);
    expect((comps[0] as Record<string, unknown>).component).toBe("Text");
    expect((comps[1] as Record<string, unknown>).component).toBe("Divider");
  });

  it("strips unknown props from validated components", () => {
    const json = JSON.stringify({
      message: "test",
      a2ui: [
        {
          type: "updateComponents",
          surfaceId: "s1",
          components: [
            {
              id: "t1",
              component: "Text",
              text: "Hello",
              variant: "h1",
              hallucinated: "extra-field",
            },
          ],
        },
      ],
      actions: [],
    });

    const result = processResponse(json);
    const comps = (result.a2uiMessages[0] as Record<string, unknown>).components as Record<string, unknown>[];
    expect(comps[0]).not.toHaveProperty("hallucinated");
    expect(comps[0].text).toBe("Hello");
  });

  it("rejects components with invalid required props", () => {
    const json = JSON.stringify({
      message: "test",
      a2ui: [
        {
          type: "updateComponents",
          surfaceId: "s1",
          components: [
            { id: "btn1", component: "Button", child: "label" },
            // Missing required 'action' prop
          ],
        },
      ],
      actions: [],
    });

    const result = processResponse(json);
    const comps = (result.a2uiMessages[0] as Record<string, unknown>).components as unknown[];
    expect(comps).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Issue #153: Nesting depth limit
  // -----------------------------------------------------------------------

  it("rejects updateDataModel with deeply nested value", () => {
    // Create a deeply nested object exceeding the limit
    let nested: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 15; i++) {
      nested = { child: nested };
    }

    const json = JSON.stringify({
      message: "test",
      a2ui: [
        {
          type: "updateDataModel",
          surfaceId: "s1",
          path: "/deep",
          value: nested,
        },
      ],
      actions: [],
    });

    const result = processResponse(json);
    expect(result.a2uiMessages).toHaveLength(0);
  });

  it("allows updateDataModel with acceptable nesting depth", () => {
    const json = JSON.stringify({
      message: "test",
      a2ui: [
        {
          type: "updateDataModel",
          surfaceId: "s1",
          path: "/app",
          value: { name: "my-app", config: { port: 3000 } },
        },
      ],
      actions: [],
    });

    const result = processResponse(json);
    expect(result.a2uiMessages).toHaveLength(1);
  });
});
