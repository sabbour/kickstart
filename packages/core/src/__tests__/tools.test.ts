/**
 * @module @kickstart/core/__tests__/tools
 *
 * Tests for the tool registry and built-in tool definitions.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "../tools/registry.js";
import { azureResourceList } from "../tools/azure-resource-list.js";
import { azureResourceGet } from "../tools/azure-resource-get.js";
import { githubRepoInfo } from "../tools/github-repo-info.js";
import { generateKubernetesManifest } from "../tools/generate-kubernetes-manifest.js";
import { estimateCost } from "../tools/estimate-cost.js";
import { defaultRegistry } from "../tools/index.js";
import { InMemoryArtifactStore } from "../artifacts/index.js";
import type { ToolContext } from "../tools/types.js";

/** Shared test context with a fresh artifact store. */
function testCtx(): ToolContext {
  return { artifactStore: new InMemoryArtifactStore() };
}

// ---------------------------------------------------------------------------
// ToolRegistry
// ---------------------------------------------------------------------------

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it("registers and retrieves a tool by name", () => {
    registry.register(azureResourceList);
    expect(registry.get("azure_resource_list")).toBe(azureResourceList);
  });

  it("returns undefined for an unknown tool name", () => {
    expect(registry.get("nonexistent_tool")).toBeUndefined();
  });

  it("registerAll adds multiple tools", () => {
    registry.registerAll([azureResourceList, azureResourceGet, githubRepoInfo]);
    expect(registry.size).toBe(3);
  });

  it("getAll returns all registered tools", () => {
    registry.registerAll([azureResourceList, estimateCost]);
    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((t) => t.name)).toContain("azure_resource_list");
    expect(all.map((t) => t.name)).toContain("estimate_cost");
  });

  it("overwriting a tool replaces it", () => {
    const mockTool = { ...azureResourceList, description: "replaced" };
    registry.register(azureResourceList);
    registry.register(mockTool);
    expect(registry.get("azure_resource_list")?.description).toBe("replaced");
    expect(registry.size).toBe(1);
  });

  it("toOpenAIFormat returns well-formed tool definitions", () => {
    registry.register(azureResourceList);
    const defs = registry.toOpenAIFormat();
    expect(defs).toHaveLength(1);
    const def = defs[0];
    expect(def.type).toBe("function");
    expect(def.function.name).toBe("azure_resource_list");
    expect(typeof def.function.description).toBe("string");
    expect(def.function.parameters).toHaveProperty("type", "object");
    expect(def.function.parameters).toHaveProperty("properties");
  });

  it("toOpenAIFormat for all tools has no missing names or descriptions", () => {
    registry.registerAll([
      azureResourceList,
      azureResourceGet,
      githubRepoInfo,
      generateKubernetesManifest,
      estimateCost,
    ]);
    for (const def of registry.toOpenAIFormat()) {
      expect(def.function.name).toBeTruthy();
      expect(def.function.description.length).toBeGreaterThan(10);
    }
  });
});

// ---------------------------------------------------------------------------
// defaultRegistry
// ---------------------------------------------------------------------------

describe("defaultRegistry", () => {
  it("has all 5 built-in tools registered", () => {
    expect(defaultRegistry.size).toBeGreaterThanOrEqual(5);
    expect(defaultRegistry.get("azure_resource_list")).toBeDefined();
    expect(defaultRegistry.get("azure_resource_get")).toBeDefined();
    expect(defaultRegistry.get("github_repo_info")).toBeDefined();
    expect(defaultRegistry.get("generate_kubernetes_manifest")).toBeDefined();
    expect(defaultRegistry.get("estimate_cost")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// azure_resource_list tool
// ---------------------------------------------------------------------------

describe("azure_resource_list tool", () => {
  it("returns a stub resource list with correct shape", async () => {
    const result = (await azureResourceList.execute({
      subscriptionId: "sub-123",
    }, testCtx())) as Record<string, unknown>;
    expect(result.subscriptionId).toBe("sub-123");
    expect(Array.isArray(result.resources)).toBe(true);
    expect(result._stub).toBe(true);
  });

  it("accepts optional resourceGroup filter", async () => {
    const result = (await azureResourceList.execute({
      subscriptionId: "sub-123",
      resourceGroup: "my-rg",
    }, testCtx())) as Record<string, unknown>;
    expect(result.resourceGroup).toBe("my-rg");
  });

  it("parameters schema requires subscriptionId", () => {
    expect(azureResourceList.parameters.required).toContain("subscriptionId");
  });
});

// ---------------------------------------------------------------------------
// azure_resource_get tool
// ---------------------------------------------------------------------------

describe("azure_resource_get tool", () => {
  it("returns resource details for a given resource ID", async () => {
    const resourceId =
      "/subscriptions/sub-123/resourceGroups/my-rg/providers/Microsoft.ContainerService/managedClusters/my-aks";
    const result = (await azureResourceGet.execute({ resourceId }, testCtx())) as Record<string, unknown>;
    expect(result.id).toBe(resourceId);
    expect(result.name).toBe("my-aks");
    expect(result._stub).toBe(true);
  });

  it("parameters schema requires resourceId", () => {
    expect(azureResourceGet.parameters.required).toContain("resourceId");
  });
});

// ---------------------------------------------------------------------------
// github_repo_info tool
// ---------------------------------------------------------------------------

describe("github_repo_info tool", () => {
  it("returns repository metadata", async () => {
    const result = (await githubRepoInfo.execute({
      owner: "myorg",
      repo: "myapp",
    }, testCtx())) as Record<string, unknown>;
    expect(result.fullName).toBe("myorg/myapp");
    expect(result.url).toContain("github.com/myorg/myapp");
    expect(result._stub).toBe(true);
  });

  it("parameters schema requires owner and repo", () => {
    expect(githubRepoInfo.parameters.required).toContain("owner");
    expect(githubRepoInfo.parameters.required).toContain("repo");
  });
});

// ---------------------------------------------------------------------------
// generate_kubernetes_manifest tool
// ---------------------------------------------------------------------------

describe("generate_kubernetes_manifest tool", () => {
  it("generates k8s manifests and returns file list", async () => {
    const result = (await generateKubernetesManifest.execute({
      appName: "my-api",
      runtime: "node",
      port: 3000,
    }, testCtx())) as Record<string, unknown>;
    expect(Array.isArray(result.files)).toBe(true);
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(files.some((f) => f.path.includes("deployment"))).toBe(true);
    expect(files.some((f) => f.path.includes("service"))).toBe(true);
  });

  it("includes ingress when needsIngress is true", async () => {
    const result = (await generateKubernetesManifest.execute({
      appName: "web-app",
      runtime: "node",
      port: 8080,
      needsIngress: true,
      customDomain: "myapp.example.com",
    }, testCtx())) as Record<string, unknown>;
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files.some((f) => f.path.includes("ingress"))).toBe(true);
    const ingress = files.find((f) => f.path.includes("ingress"))!;
    expect(ingress.content).toContain("myapp.example.com");
  });

  it("sets production replicas for production tier", async () => {
    const result = (await generateKubernetesManifest.execute({
      appName: "prod-app",
      runtime: "python",
      port: 5000,
      resourceTier: "production",
    }, testCtx())) as Record<string, unknown>;
    const files = result.files as Array<{ path: string; content: string }>;
    const deployment = files.find((f) => f.path.includes("deployment"))!;
    expect(deployment.content).toContain("replicas: 3");
  });

  it("parameters schema requires appName, runtime, and port", () => {
    expect(generateKubernetesManifest.parameters.required).toContain("appName");
    expect(generateKubernetesManifest.parameters.required).toContain("runtime");
    expect(generateKubernetesManifest.parameters.required).toContain("port");
  });
});

// ---------------------------------------------------------------------------
// estimate_cost tool
// ---------------------------------------------------------------------------

describe("estimate_cost tool", () => {
  it("returns a cost estimate with breakdown", async () => {
    const result = (await estimateCost.execute({
      region: "eastus",
      nodeCount: 3,
      vmSize: "Standard_D4s_v3",
    }, testCtx())) as Record<string, unknown>;
    expect(result.region).toBe("eastus");
    expect(result.currency).toBe("USD");
    expect(result.breakdown).toBeDefined();
    expect(typeof result.estimatedMonthlyTotal).toBe("number");
    expect((result.estimatedMonthlyTotal as number)).toBeGreaterThan(0);
    expect(result.source).toBe("stub");
  });

  it("adds database cost when needsDatabase is true", async () => {
    const withDb = (await estimateCost.execute({
      region: "eastus",
      nodeCount: 2,
      vmSize: "Standard_D4s_v3",
      needsDatabase: true,
      databaseType: "postgres",
    }, testCtx())) as Record<string, unknown>;

    const withoutDb = (await estimateCost.execute({
      region: "eastus",
      nodeCount: 2,
      vmSize: "Standard_D4s_v3",
      needsDatabase: false,
    }, testCtx())) as Record<string, unknown>;

    expect(
      (withDb.estimatedMonthlyTotal as number) >
      (withoutDb.estimatedMonthlyTotal as number)
    ).toBe(true);
  });

  it("parameters schema requires region, nodeCount, vmSize", () => {
    expect(estimateCost.parameters.required).toContain("region");
    expect(estimateCost.parameters.required).toContain("nodeCount");
    expect(estimateCost.parameters.required).toContain("vmSize");
  });
});
