import { describe, it, expect } from "vitest";
import {
  resolveDataPath,
  resolveChainedPointer,
  interpolateTemplate,
  createDefaultValues,
  interpolateA2UIMessage,
  resolveBindings,
  analyzeSharedBindings,
} from "../engine/data-binding.js";

// ---------------------------------------------------------------------------
// resolveDataPath
// ---------------------------------------------------------------------------

describe("resolveDataPath", () => {
  const model = {
    user: { name: "Alice", address: { city: "Seattle", zip: "98101" } },
    items: ["alpha", "beta", "gamma"],
    nested: { list: [{ id: 1 }, { id: 2 }] },
    "special~key": "tilde",
    "slash/key": "slash",
    empty: "",
    zero: 0,
    flag: false,
  };

  it("resolves top-level key", () => {
    expect(resolveDataPath("/user", model)).toEqual(model.user);
  });

  it("resolves nested object path", () => {
    expect(resolveDataPath("/user/name", model)).toBe("Alice");
  });

  it("resolves deeply nested path", () => {
    expect(resolveDataPath("/user/address/city", model)).toBe("Seattle");
  });

  it("resolves array index", () => {
    expect(resolveDataPath("/items/0", model)).toBe("alpha");
    expect(resolveDataPath("/items/2", model)).toBe("gamma");
  });

  it("resolves nested objects inside arrays", () => {
    expect(resolveDataPath("/nested/list/0/id", model)).toBe(1);
    expect(resolveDataPath("/nested/list/1/id", model)).toBe(2);
  });

  it("returns the root for '/' or empty string", () => {
    expect(resolveDataPath("/", model)).toEqual(model);
    expect(resolveDataPath("", model)).toEqual(model);
  });

  it("returns undefined for missing paths", () => {
    expect(resolveDataPath("/nonexistent", model)).toBeUndefined();
    expect(resolveDataPath("/user/age", model)).toBeUndefined();
  });

  it("returns defaultValue for missing paths when provided", () => {
    expect(resolveDataPath("/missing", model, "fallback")).toBe("fallback");
    expect(resolveDataPath("/user/age", model, 25)).toBe(25);
    expect(resolveDataPath("/deep/nested/missing", model, null)).toBeNull();
  });

  it("does not use defaultValue when value exists but is falsy", () => {
    expect(resolveDataPath("/empty", model, "default")).toBe("");
    expect(resolveDataPath("/zero", model, 99)).toBe(0);
    expect(resolveDataPath("/flag", model, true)).toBe(false);
  });

  it("handles RFC 6901 tilde escaping: ~0 → ~, ~1 → /", () => {
    expect(resolveDataPath("/special~0key", model)).toBe("tilde");
    expect(resolveDataPath("/slash~1key", model)).toBe("slash");
  });

  it("returns undefined when traversing through a primitive", () => {
    expect(resolveDataPath("/user/name/char", model)).toBeUndefined();
  });

  it("returns defaultValue when traversing through a primitive", () => {
    expect(resolveDataPath("/user/name/char", model, "oops")).toBe("oops");
  });

  it("handles paths without leading slash", () => {
    expect(resolveDataPath("user/name", model)).toBe("Alice");
  });
});

// ---------------------------------------------------------------------------
// resolveChainedPointer
// ---------------------------------------------------------------------------

describe("resolveChainedPointer", () => {
  it("follows a single pointer indirection", () => {
    const model = {
      config: { activeProfile: "/profiles/prod" },
      profiles: { prod: { replicas: 3 } },
    };
    expect(resolveChainedPointer("/config/activeProfile", model)).toEqual({
      replicas: 3,
    });
  });

  it("follows multiple pointer indirections", () => {
    const model = {
      a: "/b",
      b: "/c",
      c: "final-value",
    };
    expect(resolveChainedPointer("/a", model)).toBe("final-value");
  });

  it("returns non-pointer values directly", () => {
    const model = { name: "Alice" };
    expect(resolveChainedPointer("/name", model)).toBe("Alice");
  });

  it("returns defaultValue for missing initial path", () => {
    expect(
      resolveChainedPointer("/missing", {}, { defaultValue: "none" })
    ).toBe("none");
  });

  it("returns defaultValue when chain target is missing", () => {
    const model = { ref: "/nonexistent" };
    expect(
      resolveChainedPointer("/ref", model, { defaultValue: "fallback" })
    ).toBe("fallback");
  });

  it("detects circular references and returns defaultValue", () => {
    const model = { a: "/b", b: "/a" };
    expect(
      resolveChainedPointer("/a", model, { defaultValue: "cycle!" })
    ).toBe("cycle!");
  });

  it("respects maxDepth limit", () => {
    const model = {
      a: "/b",
      b: "/c",
      c: "/d",
      d: "deep",
    };
    // maxDepth=1: resolves /a → "/b", then /b → "/c", then stops (exceeded)
    expect(
      resolveChainedPointer("/a", model, { maxDepth: 1, defaultValue: "max" })
    ).toBe("max");
    // maxDepth=3: can follow the full chain
    expect(resolveChainedPointer("/a", model, { maxDepth: 3 })).toBe("deep");
  });

  it("handles objects and arrays as terminal values", () => {
    const model = {
      ref: "/data",
      data: { items: [1, 2, 3] },
    };
    expect(resolveChainedPointer("/ref", model)).toEqual({
      items: [1, 2, 3],
    });
  });

  it("does not follow strings that don't start with /", () => {
    const model = { name: "just-a-string" };
    expect(resolveChainedPointer("/name", model)).toBe("just-a-string");
  });
});

// ---------------------------------------------------------------------------
// interpolateTemplate
// ---------------------------------------------------------------------------

describe("interpolateTemplate", () => {
  const model = {
    user: { name: "Alice", age: 30 },
    config: { region: "eastus2" },
    items: ["a", "b"],
  };

  it("replaces single placeholder", () => {
    expect(interpolateTemplate("Hello {{/user/name}}!", model)).toBe(
      "Hello Alice!"
    );
  });

  it("replaces multiple placeholders", () => {
    expect(
      interpolateTemplate(
        "{{/user/name}} in {{/config/region}}",
        model
      )
    ).toBe("Alice in eastus2");
  });

  it("stringifies object values", () => {
    expect(interpolateTemplate("Data: {{/user}}", model)).toBe(
      'Data: {"name":"Alice","age":30}'
    );
  });

  it("leaves unresolved placeholders as-is (no default)", () => {
    expect(interpolateTemplate("Hi {{/missing}}!", model)).toBe(
      "Hi {{/missing}}!"
    );
  });

  it("uses default value when path is missing (pipe syntax)", () => {
    expect(interpolateTemplate("Hi {{/missing|stranger}}!", model)).toBe(
      "Hi stranger!"
    );
  });

  it("uses resolved value over default when path exists", () => {
    expect(
      interpolateTemplate("Hi {{/user/name|stranger}}!", model)
    ).toBe("Hi Alice!");
  });

  it("allows empty default value", () => {
    expect(interpolateTemplate("Hi {{/missing|}}!", model)).toBe("Hi !");
  });

  it("splits on first pipe only — allows | in default text", () => {
    expect(
      interpolateTemplate("{{/missing|a|b|c}}", model)
    ).toBe("a|b|c");
  });

  it("trims whitespace around path and pipe", () => {
    expect(
      interpolateTemplate("{{ /user/name | fallback }}", model)
    ).toBe("Alice");
  });

  it("uses default when value is null", () => {
    const m = { val: null } as unknown as Record<string, unknown>;
    expect(interpolateTemplate("{{/val|none}}", m)).toBe("none");
  });

  it("returns template unchanged when no placeholders exist", () => {
    expect(interpolateTemplate("No placeholders here", model)).toBe(
      "No placeholders here"
    );
  });
});

// ---------------------------------------------------------------------------
// createDefaultValues
// ---------------------------------------------------------------------------

describe("createDefaultValues", () => {
  it("generates defaults for simple object schema", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        count: { type: "number" },
        active: { type: "boolean" },
      },
    };
    expect(createDefaultValues(schema)).toEqual({
      name: "",
      count: 0,
      active: false,
    });
  });

  it("uses explicit schema defaults", () => {
    const schema = {
      type: "object",
      properties: {
        region: { type: "string", default: "westus2" },
        replicas: { type: "integer", default: 3 },
      },
    };
    expect(createDefaultValues(schema)).toEqual({
      region: "westus2",
      replicas: 3,
    });
  });

  it("handles nested objects", () => {
    const schema = {
      type: "object",
      properties: {
        config: {
          type: "object",
          properties: {
            host: { type: "string" },
            port: { type: "number" },
          },
        },
      },
    };
    expect(createDefaultValues(schema)).toEqual({
      config: { host: "", port: 0 },
    });
  });

  it("handles arrays", () => {
    const schema = {
      type: "object",
      properties: { tags: { type: "array" } },
    };
    expect(createDefaultValues(schema)).toEqual({ tags: [] });
  });

  it("returns empty object for non-object root", () => {
    expect(createDefaultValues({ type: "string" })).toEqual({});
  });

  it("handles union types (picks first)", () => {
    const schema = {
      type: "object",
      properties: {
        val: { type: ["string", "number"] },
      },
    };
    expect(createDefaultValues(schema)).toEqual({ val: "" });
  });
});

// ---------------------------------------------------------------------------
// interpolateA2UIMessage
// ---------------------------------------------------------------------------

describe("interpolateA2UIMessage", () => {
  const model = { app: { name: "demo" }, region: "eastus" };

  it("interpolates string values in a flat object", () => {
    const msg = { text: "Deploy {{/app/name}}", region: "{{/region}}" };
    expect(interpolateA2UIMessage(msg, model)).toEqual({
      text: "Deploy demo",
      region: "eastus",
    });
  });

  it("interpolates strings in nested objects", () => {
    const msg = { outer: { inner: "{{/app/name}}" } };
    expect(interpolateA2UIMessage(msg, model)).toEqual({
      outer: { inner: "demo" },
    });
  });

  it("interpolates strings in arrays", () => {
    const msg = { items: ["{{/app/name}}", "{{/region}}"] };
    expect(interpolateA2UIMessage(msg, model)).toEqual({
      items: ["demo", "eastus"],
    });
  });

  it("leaves non-string values untouched", () => {
    const msg = { count: 42, flag: true, nothing: null };
    expect(
      interpolateA2UIMessage(msg, model)
    ).toEqual({ count: 42, flag: true, nothing: null });
  });

  it("supports default values in nested interpolation", () => {
    const msg = { greeting: "Hello {{/user/name|World}}" };
    expect(interpolateA2UIMessage(msg, model)).toEqual({
      greeting: "Hello World",
    });
  });
});

// ---------------------------------------------------------------------------
// resolveBindings
// ---------------------------------------------------------------------------

describe("resolveBindings", () => {
  const model = {
    user: { name: "Alice", email: "alice@example.com" },
    config: { region: "eastus2" },
  };

  it("resolves multiple bindings at once", () => {
    const result = resolveBindings(
      {
        name: { path: "/user/name" },
        region: { path: "/config/region" },
      },
      model
    );
    expect(result).toEqual({ name: "Alice", region: "eastus2" });
  });

  it("applies defaultValue for missing paths", () => {
    const result = resolveBindings(
      {
        name: { path: "/user/name" },
        missing: { path: "/nonexistent", defaultValue: "N/A" },
      },
      model
    );
    expect(result).toEqual({ name: "Alice", missing: "N/A" });
  });

  it("returns undefined for missing paths without defaults", () => {
    const result = resolveBindings(
      { x: { path: "/does/not/exist" } },
      model
    );
    expect(result).toEqual({ x: undefined });
  });

  it("handles empty bindings map", () => {
    expect(resolveBindings({}, model)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// analyzeSharedBindings
// ---------------------------------------------------------------------------

describe("analyzeSharedBindings", () => {
  it("finds paths shared between producer and consumer", () => {
    const result = analyzeSharedBindings({
      textField: { reads: [], writes: ["/form/name"] },
      display: { reads: ["/form/name"], writes: [] },
    });
    expect(result.sharedPaths).toEqual(["/form/name"]);
    expect(result.producers["/form/name"]).toEqual(["textField"]);
    expect(result.consumers["/form/name"]).toEqual(["display"]);
  });

  it("excludes self-reads (component reads its own writes)", () => {
    const result = analyzeSharedBindings({
      combo: { reads: ["/value"], writes: ["/value"] },
    });
    // combo reads and writes /value, but no *different* component reads it
    expect(result.sharedPaths).toEqual([]);
  });

  it("handles multiple producers and consumers", () => {
    const result = analyzeSharedBindings({
      input1: { reads: [], writes: ["/shared"] },
      input2: { reads: [], writes: ["/shared"] },
      display1: { reads: ["/shared"], writes: [] },
      display2: { reads: ["/shared"], writes: [] },
    });
    expect(result.sharedPaths).toEqual(["/shared"]);
    expect(result.producers["/shared"]).toEqual(["input1", "input2"]);
    expect(result.consumers["/shared"]).toContain("display1");
    expect(result.consumers["/shared"]).toContain("display2");
  });

  it("returns sorted shared paths", () => {
    const result = analyzeSharedBindings({
      a: { reads: [], writes: ["/z/path", "/a/path"] },
      b: { reads: ["/z/path", "/a/path"], writes: [] },
    });
    expect(result.sharedPaths).toEqual(["/a/path", "/z/path"]);
  });

  it("handles empty component set", () => {
    const result = analyzeSharedBindings({});
    expect(result.sharedPaths).toEqual([]);
    expect(result.producers).toEqual({});
    expect(result.consumers).toEqual({});
  });

  it("ignores paths that are only read (no writer)", () => {
    const result = analyzeSharedBindings({
      reader: { reads: ["/orphan"], writes: [] },
    });
    expect(result.sharedPaths).toEqual([]);
  });

  it("ignores paths that are only written (no external reader)", () => {
    const result = analyzeSharedBindings({
      writer: { reads: [], writes: ["/solo"] },
    });
    expect(result.sharedPaths).toEqual([]);
  });
});
