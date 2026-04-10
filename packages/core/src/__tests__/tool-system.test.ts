/**
 * B-13 — LLM Tool System
 *
 * Contract tests for:
 *   • Tool interface (name, description, parameters, execute)
 *   • ToolRegistry (register, lookup, duplicate handling, OpenAI export)
 *   • Tool execution (valid args, missing required args, invalid types)
 *   • OpenAI function-calling integration format
 *   • Multi-step tool-call loops (call → result → call → result → final)
 *   • Specific built-in tools: generate_kubernetes_manifest, azure_resource_list, estimate_cost
 *
 * Written TDD-style. Tests that target missing validation logic will fail
 * until Bender wires runtime arg checking (B-13).
 */

import { describe, it, expect, vi } from "vitest";
import { ToolRegistry } from "../tools/registry.js";
import type { Tool, ToolCall, ToolCallResult } from "../tools/types.js";
import { generateKubernetesManifest } from "../tools/generate-kubernetes-manifest.js";
import { azureResourceList } from "../tools/azure-resource-list.js";
import { estimateCost } from "../tools/estimate-cost.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal valid stub Tool for registry tests. */
function makeTool(
  name: string,
  overrides: Partial<Tool> = {},
): Tool<Record<string, unknown>> {
  return {
    name,
    description: `${name} description`,
    parameters: {
      type: "object",
      properties: {
        input: { type: "string", description: "Input value" },
      },
      required: ["input"],
    },
    execute: vi.fn().mockResolvedValue({ result: `${name}-result` }),
    ...overrides,
  };
}

/** Minimal valid ToolCall as the LLM would produce it. */
function makeToolCall(name: string, args: Record<string, unknown> = {}): ToolCall {
  return {
    id: `call_${name}_${Date.now()}`,
    type: "function",
    function: { name, arguments: JSON.stringify(args) },
  };
}

/** Build a ToolCallResult (what the executor returns to the API). */
function makeToolCallResult(call: ToolCall, result: unknown): ToolCallResult {
  return {
    toolCallId: call.id,
    toolName: call.function.name,
    result,
  };
}

// ── 1. Tool interface contract ────────────────────────────────────────────────

describe("Tool interface contract", () => {
  it("has required string fields: name and description", () => {
    const tool = makeTool("my_tool");
    expect(typeof tool.name).toBe("string");
    expect(tool.name.length).toBeGreaterThan(0);
    expect(typeof tool.description).toBe("string");
    expect(tool.description.length).toBeGreaterThan(0);
  });

  it("parameters schema has type 'object'", () => {
    const tool = makeTool("schema_tool");
    expect(tool.parameters.type).toBe("object");
  });

  it("parameters schema has a 'properties' object", () => {
    const tool = makeTool("props_tool");
    expect(tool.parameters.properties).toBeDefined();
    expect(typeof tool.parameters.properties).toBe("object");
  });

  it("parameters 'required' field is an array when present", () => {
    const tool = makeTool("req_tool");
    expect(Array.isArray(tool.parameters.required)).toBe(true);
  });

  it("execute is a function", () => {
    const tool = makeTool("exec_tool");
    expect(typeof tool.execute).toBe("function");
  });

  it("execute returns a Promise", async () => {
    const tool = makeTool("promise_tool");
    const result = tool.execute({ input: "test" });
    expect(result).toBeInstanceOf(Promise);
    await result; // must resolve, not reject
  });

  it("execute resolves to a non-undefined result", async () => {
    const tool = makeTool("result_tool");
    const result = await tool.execute({ input: "x" });
    expect(result).not.toBeUndefined();
  });

  it("tool name follows valid identifier format (no spaces)", () => {
    const tool = makeTool("valid_name");
    expect(tool.name).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
  });
});

// ── 2. ToolRegistry ───────────────────────────────────────────────────────────

describe("ToolRegistry", () => {
  describe("register and lookup", () => {
    it("registered tool is retrievable by name", () => {
      const registry = new ToolRegistry();
      const tool = makeTool("lookup_me");
      registry.register(tool);
      expect(registry.get("lookup_me")).toBe(tool);
    });

    it("returns undefined for non-existent tool", () => {
      const registry = new ToolRegistry();
      expect(registry.get("does_not_exist")).toBeUndefined();
    });

    it("size is 0 on empty registry", () => {
      const registry = new ToolRegistry();
      expect(registry.size).toBe(0);
    });

    it("size increments with each unique registration", () => {
      const registry = new ToolRegistry();
      registry.register(makeTool("a"));
      registry.register(makeTool("b"));
      expect(registry.size).toBe(2);
    });

    it("registerAll registers every tool in the array", () => {
      const registry = new ToolRegistry();
      registry.registerAll([makeTool("x"), makeTool("y"), makeTool("z")]);
      expect(registry.size).toBe(3);
      expect(registry.get("x")).toBeDefined();
      expect(registry.get("y")).toBeDefined();
      expect(registry.get("z")).toBeDefined();
    });
  });

  describe("duplicate registration", () => {
    it("registering duplicate name overwrites the first tool", () => {
      const registry = new ToolRegistry();
      const first = makeTool("dup");
      const second = makeTool("dup", { description: "second version" });
      registry.register(first);
      registry.register(second);
      expect(registry.get("dup")?.description).toBe("second version");
    });

    it("size does not grow when overwriting a duplicate", () => {
      const registry = new ToolRegistry();
      registry.register(makeTool("same"));
      registry.register(makeTool("same"));
      expect(registry.size).toBe(1);
    });
  });

  describe("toOpenAIFormat", () => {
    it("returns an array", () => {
      const registry = new ToolRegistry();
      expect(Array.isArray(registry.toOpenAIFormat())).toBe(true);
    });

    it("empty registry produces empty array", () => {
      const registry = new ToolRegistry();
      expect(registry.toOpenAIFormat()).toHaveLength(0);
    });

    it("each exported entry has type 'function'", () => {
      const registry = new ToolRegistry();
      registry.register(makeTool("openai_a"));
      registry.register(makeTool("openai_b"));
      for (const def of registry.toOpenAIFormat()) {
        expect(def.type).toBe("function");
      }
    });

    it("each exported function has name, description, and parameters", () => {
      const registry = new ToolRegistry();
      registry.register(makeTool("full_def"));
      const [def] = registry.toOpenAIFormat();
      expect(typeof def.function.name).toBe("string");
      expect(typeof def.function.description).toBe("string");
      expect(def.function.parameters).toBeDefined();
    });

    it("exported function name matches original tool name", () => {
      const registry = new ToolRegistry();
      registry.register(makeTool("match_name"));
      const [def] = registry.toOpenAIFormat();
      expect(def.function.name).toBe("match_name");
    });

    it("exported count matches registered tool count", () => {
      const registry = new ToolRegistry();
      registry.registerAll([makeTool("t1"), makeTool("t2"), makeTool("t3")]);
      expect(registry.toOpenAIFormat()).toHaveLength(3);
    });
  });

  describe("getAll", () => {
    it("returns all registered tools as an array", () => {
      const registry = new ToolRegistry();
      registry.registerAll([makeTool("ga1"), makeTool("ga2")]);
      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });

    it("returns empty array when registry is empty", () => {
      const registry = new ToolRegistry();
      expect(registry.getAll()).toEqual([]);
    });
  });
});

// ── 3. Tool execution ─────────────────────────────────────────────────────────

describe("Tool execution", () => {
  describe("stub tool with valid args", () => {
    it("returns the expected result object", async () => {
      const tool = makeTool("stub_exec");
      const result = await tool.execute({ input: "hello" });
      expect(result).toEqual({ result: "stub_exec-result" });
    });

    it("execute is called with the provided args", async () => {
      const tool = makeTool("arg_check");
      await tool.execute({ input: "passed-value" });
      expect(tool.execute).toHaveBeenCalledWith({ input: "passed-value" });
    });
  });

  describe("missing required args — graceful handling (TDD targets)", () => {
    it("execute with empty args object does not throw", async () => {
      // Stubs may return degraded results but must not crash
      await expect(azureResourceList.execute({} as any)).resolves.toBeDefined();
    });

    it("execute with null arg values does not throw", async () => {
      await expect(azureResourceList.execute({ subscriptionId: null as any })).resolves.toBeDefined();
    });

    it("execute with missing required args returns an error indicator OR degrades gracefully", async () => {
      // A well-implemented tool should either return { error: ... } or throw a typed error.
      // Stub currently returns data with undefined fields — this test documents the expected contract.
      const result = await azureResourceList.execute({} as any) as Record<string, unknown>;
      // Must return either a result object or an error field — not undefined
      expect(result).not.toBeUndefined();
    });
  });

  describe("invalid arg types — graceful handling (TDD targets)", () => {
    it("estimate_cost with string nodeCount does not crash", async () => {
      await expect(
        estimateCost.execute({
          region: "eastus",
          nodeCount: "three" as any,
          vmSize: "Standard_D4s_v3",
        }),
      ).resolves.toBeDefined();
    });

    it("generate_kubernetes_manifest with numeric appName does not crash", async () => {
      await expect(
        generateKubernetesManifest.execute({
          appName: 42 as any,
          runtime: "node",
          port: 3000,
        }),
      ).resolves.toBeDefined();
    });
  });
});

// ── 4. OpenAI integration format ──────────────────────────────────────────────

describe("OpenAI integration format", () => {
  describe("tool definitions for function-calling schema", () => {
    it("ToolRegistry produces valid OpenAI tool definitions", () => {
      const registry = new ToolRegistry();
      registry.register(makeTool("schema_check"));
      const defs = registry.toOpenAIFormat();
      const def = defs[0];
      expect(def).toMatchObject({
        type: "function",
        function: {
          name: expect.any(String),
          description: expect.any(String),
          parameters: expect.objectContaining({ type: "object" }),
        },
      });
    });

    it("parameters in OpenAI format retains the original JSON Schema structure", () => {
      const registry = new ToolRegistry();
      const tool = makeTool("schema_retain");
      registry.register(tool);
      const [def] = registry.toOpenAIFormat();
      expect(def.function.parameters).toEqual(tool.parameters);
    });
  });

  describe("ToolCall format (LLM → executor)", () => {
    it("ToolCall has id, type 'function', and function.name / function.arguments", () => {
      const call = makeToolCall("my_tool", { param: "val" });
      expect(call.id).toBeTruthy();
      expect(call.type).toBe("function");
      expect(call.function.name).toBe("my_tool");
      expect(typeof call.function.arguments).toBe("string");
    });

    it("ToolCall.function.arguments is valid JSON", () => {
      const call = makeToolCall("json_tool", { key: "value", num: 42 });
      expect(() => JSON.parse(call.function.arguments)).not.toThrow();
    });

    it("parsed ToolCall arguments match the original object", () => {
      const args = { region: "eastus", nodeCount: 3 };
      const call = makeToolCall("args_tool", args);
      expect(JSON.parse(call.function.arguments)).toEqual(args);
    });
  });

  describe("ToolCallResult format (executor → API message)", () => {
    it("ToolCallResult has toolCallId, toolName, and result", () => {
      const call = makeToolCall("result_tool");
      const res = makeToolCallResult(call, { data: 42 });
      expect(res.toolCallId).toBe(call.id);
      expect(res.toolName).toBe("result_tool");
      expect(res.result).toEqual({ data: 42 });
    });

    it("ToolCallResult error field is optional (present only on failure)", () => {
      const call = makeToolCall("error_tool");
      const success = makeToolCallResult(call, { ok: true });
      expect(success.error).toBeUndefined();

      const failure: ToolCallResult = {
        toolCallId: call.id,
        toolName: call.function.name,
        result: null,
        error: "Tool execution failed",
      };
      expect(failure.error).toBe("Tool execution failed");
    });
  });

  describe("multi-step tool call loop", () => {
    it("simulates call → result → call → result → final sequence", async () => {
      // Simulate a two-turn tool-use loop without hitting the real API.
      const registry = new ToolRegistry();
      const counterTool = makeTool("counter", {
        execute: vi.fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 2 }),
      });
      registry.register(counterTool);

      const history: Array<{ role: string; content?: unknown; tool_call_id?: string; name?: string }> = [
        { role: "user", content: "Count twice" },
      ];

      // Turn 1 — assistant requests first tool call
      const call1 = makeToolCall("counter", { step: 1 });
      history.push({ role: "assistant", content: null });

      const result1 = await registry.get("counter")!.execute(JSON.parse(call1.function.arguments));
      history.push({ role: "tool", tool_call_id: call1.id, name: "counter", content: JSON.stringify(result1) });

      // Turn 2 — assistant requests second tool call
      const call2 = makeToolCall("counter", { step: 2 });
      const result2 = await registry.get("counter")!.execute(JSON.parse(call2.function.arguments));
      history.push({ role: "tool", tool_call_id: call2.id, name: "counter", content: JSON.stringify(result2) });

      // Final — assistant synthesises answer
      history.push({ role: "assistant", content: "Done counting." });

      expect(counterTool.execute).toHaveBeenCalledTimes(2);
      expect(history.filter((m) => m.role === "tool")).toHaveLength(2);
      expect(history[history.length - 1].role).toBe("assistant");
    });

    it("tool results are stringified JSON in the 'tool' message content", async () => {
      const result = { count: 42 };
      const call = makeToolCall("any_tool");
      const message = { role: "tool", tool_call_id: call.id, content: JSON.stringify(result) };
      const parsed = JSON.parse(message.content as string);
      expect(parsed).toEqual(result);
    });
  });
});

// ── 5. Specific built-in tools ────────────────────────────────────────────────

describe("generate_kubernetes_manifest tool", () => {
  it("has the correct name", () => {
    expect(generateKubernetesManifest.name).toBe("generate_kubernetes_manifest");
  });

  it("requires appName, runtime, and port", () => {
    expect(generateKubernetesManifest.parameters.required).toContain("appName");
    expect(generateKubernetesManifest.parameters.required).toContain("runtime");
    expect(generateKubernetesManifest.parameters.required).toContain("port");
  });

  it("execute with minimal valid args resolves without throwing", async () => {
    await expect(
      generateKubernetesManifest.execute({ appName: "my-app", runtime: "node", port: 3000 }),
    ).resolves.toBeDefined();
  });

  it("result contains a files array", async () => {
    const result = await generateKubernetesManifest.execute({
      appName: "my-app",
      runtime: "node",
      port: 3000,
    }) as { files: unknown[] };
    expect(Array.isArray(result.files)).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);
  });

  it("each file in the result has path, language, and content fields", async () => {
    const result = await generateKubernetesManifest.execute({
      appName: "my-app",
      runtime: "node",
      port: 3000,
    }) as { files: Array<{ path: string; language: string; content: string }> };
    for (const file of result.files) {
      expect(typeof file.path).toBe("string");
      expect(typeof file.language).toBe("string");
      expect(typeof file.content).toBe("string");
    }
  });

  it("file content is non-empty YAML string", async () => {
    const result = await generateKubernetesManifest.execute({
      appName: "yaml-app",
      runtime: "python",
      port: 8000,
    }) as { files: Array<{ content: string }> };
    for (const file of result.files) {
      expect(file.content.trim().length).toBeGreaterThan(0);
    }
  });

  it("appName appears in generated manifest content", async () => {
    const result = await generateKubernetesManifest.execute({
      appName: "test-webapp",
      runtime: "node",
      port: 8080,
    }) as { files: Array<{ content: string }> };
    const allContent = result.files.map((f) => f.content).join("\n");
    expect(allContent).toContain("test-webapp");
  });

  it("ingress file is generated when needsIngress is true", async () => {
    const result = await generateKubernetesManifest.execute({
      appName: "ingress-app",
      runtime: "go",
      port: 8080,
      needsIngress: true,
    }) as { files: Array<{ path: string }> };
    const paths = result.files.map((f) => f.path);
    expect(paths.some((p) => p.toLowerCase().includes("ingress"))).toBe(true);
  });
});

describe("azure_resource_list tool", () => {
  it("has the correct name", () => {
    expect(azureResourceList.name).toBe("azure_resource_list");
  });

  it("requires subscriptionId", () => {
    expect(azureResourceList.parameters.required).toContain("subscriptionId");
  });

  it("execute with valid subscriptionId resolves", async () => {
    await expect(
      azureResourceList.execute({ subscriptionId: "00000000-0000-0000-0000-000000000000" }),
    ).resolves.toBeDefined();
  });

  it("result contains a resources array", async () => {
    const result = await azureResourceList.execute({
      subscriptionId: "00000000-0000-0000-0000-000000000000",
    }) as { resources: unknown[] };
    expect(Array.isArray(result.resources)).toBe(true);
  });

  it("each resource has id, name, type, and location", async () => {
    const result = await azureResourceList.execute({
      subscriptionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    }) as { resources: Array<{ id: string; name: string; type: string; location: string }> };
    for (const resource of result.resources) {
      expect(typeof resource.id).toBe("string");
      expect(typeof resource.name).toBe("string");
      expect(typeof resource.type).toBe("string");
      expect(typeof resource.location).toBe("string");
    }
  });

  it("result reflects the provided subscriptionId", async () => {
    const subId = "12345678-abcd-1234-efgh-000000000000";
    const result = await azureResourceList.execute({ subscriptionId: subId }) as { subscriptionId: string };
    expect(result.subscriptionId).toBe(subId);
  });
});

describe("estimate_cost tool", () => {
  it("has the correct name", () => {
    expect(estimateCost.name).toBe("estimate_cost");
  });

  it("requires region, nodeCount, and vmSize", () => {
    expect(estimateCost.parameters.required).toContain("region");
    expect(estimateCost.parameters.required).toContain("nodeCount");
    expect(estimateCost.parameters.required).toContain("vmSize");
  });

  it("execute with valid args resolves", async () => {
    await expect(
      estimateCost.execute({ region: "eastus", nodeCount: 3, vmSize: "Standard_D4s_v3" }),
    ).resolves.toBeDefined();
  });

  it("result contains estimatedMonthlyTotal as a number", async () => {
    const result = await estimateCost.execute({
      region: "eastus",
      nodeCount: 3,
      vmSize: "Standard_D4s_v3",
    }) as { estimatedMonthlyTotal: number };
    expect(typeof result.estimatedMonthlyTotal).toBe("number");
    expect(result.estimatedMonthlyTotal).toBeGreaterThan(0);
  });

  it("result contains a breakdown object", async () => {
    const result = await estimateCost.execute({
      region: "eastus",
      nodeCount: 2,
      vmSize: "Standard_B2s",
    }) as { breakdown: Record<string, unknown> };
    expect(result.breakdown).toBeDefined();
    expect(typeof result.breakdown).toBe("object");
  });

  it("breakdown has compute, networking, storage, and database keys", async () => {
    const result = await estimateCost.execute({
      region: "westeurope",
      nodeCount: 2,
      vmSize: "Standard_D2s_v3",
    }) as { breakdown: { compute: unknown; networking: unknown; storage: unknown; database: unknown } };
    expect(result.breakdown.compute).toBeDefined();
    expect(result.breakdown.networking).toBeDefined();
    expect(result.breakdown.storage).toBeDefined();
    expect(result.breakdown.database).toBeDefined();
  });

  it("result currency is USD", async () => {
    const result = await estimateCost.execute({
      region: "eastus",
      nodeCount: 1,
      vmSize: "Standard_B2s",
    }) as { currency: string };
    expect(result.currency).toBe("USD");
  });

  it("higher nodeCount produces a higher compute cost", async () => {
    const small = await estimateCost.execute({
      region: "eastus", nodeCount: 1, vmSize: "Standard_D4s_v3",
    }) as { breakdown: { compute: { monthlyCost: number } } };

    const large = await estimateCost.execute({
      region: "eastus", nodeCount: 5, vmSize: "Standard_D4s_v3",
    }) as { breakdown: { compute: { monthlyCost: number } } };

    expect(large.breakdown.compute.monthlyCost).toBeGreaterThan(small.breakdown.compute.monthlyCost);
  });

  it("including a database adds database cost to the breakdown", async () => {
    const withDb = await estimateCost.execute({
      region: "eastus", nodeCount: 2, vmSize: "Standard_D4s_v3",
      needsDatabase: true, databaseType: "postgres",
    }) as { breakdown: { database: { monthlyCost: number } } };

    const withoutDb = await estimateCost.execute({
      region: "eastus", nodeCount: 2, vmSize: "Standard_D4s_v3",
      needsDatabase: false,
    }) as { breakdown: { database: { monthlyCost: number } } };

    expect(withDb.breakdown.database.monthlyCost).toBeGreaterThan(
      withoutDb.breakdown.database.monthlyCost,
    );
  });
});
