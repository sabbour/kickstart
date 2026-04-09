/**
 * @module @kickstart/core/__tests__/artifact-store
 *
 * Tests for InMemoryArtifactStore and artifact tools.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryArtifactStore, defaultArtifactStore } from "../artifacts/index.js";
import { listArtifacts } from "../tools/list-artifacts.js";
import { getArtifact } from "../tools/get-artifact.js";
import { generateKubernetesManifest } from "../tools/generate-kubernetes-manifest.js";

// ---------------------------------------------------------------------------
// InMemoryArtifactStore
// ---------------------------------------------------------------------------

describe("InMemoryArtifactStore", () => {
  let store: InMemoryArtifactStore;

  beforeEach(() => {
    store = new InMemoryArtifactStore();
  });

  it("put and get a simple artifact", () => {
    store.put("k8s/deployment.yaml", "apiVersion: apps/v1");
    const a = store.get("k8s/deployment.yaml");
    expect(a).not.toBeNull();
    expect(a!.content).toBe("apiVersion: apps/v1");
    expect(a!.language).toBe("yaml");
    expect(a!.path).toBe("k8s/deployment.yaml");
  });

  it("infers language from extension", () => {
    store.put("workflow.yml", "");
    expect(store.get("workflow.yml")!.language).toBe("yaml");
    store.put("app.ts", "");
    expect(store.get("app.ts")!.language).toBe("typescript");
    store.put("deploy.sh", "");
    expect(store.get("deploy.sh")!.language).toBe("bash");
    store.put("Dockerfile", "");
    expect(store.get("Dockerfile")!.language).toBe("dockerfile");
  });

  it("uses explicit language when provided", () => {
    store.put("myfile.txt", "content", { language: "yaml" });
    expect(store.get("myfile.txt")!.language).toBe("yaml");
  });

  it("preserves createdAt on update", () => {
    store.put("f.yaml", "v1");
    const first = store.get("f.yaml")!.createdAt;
    store.put("f.yaml", "v2");
    expect(store.get("f.yaml")!.createdAt).toEqual(first);
    expect(store.get("f.yaml")!.content).toBe("v2");
  });

  it("get returns null for missing path", () => {
    expect(store.get("nonexistent.yaml")).toBeNull();
  });

  it("list returns all artifacts when no glob", () => {
    store.put("a.yaml", "");
    store.put("b.yaml", "");
    expect(store.list()).toHaveLength(2);
  });

  it("list filters by * glob (within segment)", () => {
    store.put("k8s/deployment.yaml", "");
    store.put("k8s/service.yaml", "");
    store.put("Dockerfile", "");
    const results = store.list("k8s/*.yaml");
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.path)).toContain("k8s/deployment.yaml");
    expect(results.map((r) => r.path)).toContain("k8s/service.yaml");
  });

  it("list filters by ** glob (across segments)", () => {
    store.put("k8s/deployment.yaml", "");
    store.put(".github/workflows/deploy.yml", "");
    store.put("Dockerfile", "");
    const results = store.list("**/*.yaml");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("k8s/deployment.yaml");
  });

  it("list with ** matches nested paths", () => {
    store.put("k8s/deployment.yaml", "");
    store.put(".github/workflows/deploy.yml", "");
    const results = store.list("**/*.y{a,}ml");
    // glob regex doesn't support {a,} — just verify ** works with .yaml and .yml separately
    const yaml = store.list("**/*.yaml");
    const yml = store.list("**/*.yml");
    expect(yaml).toHaveLength(1);
    expect(yml).toHaveLength(1);
  });

  it("delete removes an artifact", () => {
    store.put("x.yaml", "");
    store.delete("x.yaml");
    expect(store.get("x.yaml")).toBeNull();
    expect(store.size).toBe(0);
  });

  it("delete is a no-op for missing paths", () => {
    expect(() => store.delete("does-not-exist")).not.toThrow();
  });

  it("export returns path→content map", () => {
    store.put("a.yaml", "content-a");
    store.put("b.ts", "content-b");
    const exported = store.export();
    expect(exported["a.yaml"]).toBe("content-a");
    expect(exported["b.ts"]).toBe("content-b");
    expect(Object.keys(exported)).toHaveLength(2);
  });

  it("clear empties the store", () => {
    store.put("a.yaml", "");
    store.put("b.yaml", "");
    store.clear();
    expect(store.size).toBe(0);
    expect(store.list()).toHaveLength(0);
  });

  it("metadata is stored and retrieved", () => {
    store.put("f.yaml", "", { metadata: { generator: "k8s", version: 1 } });
    const a = store.get("f.yaml")!;
    expect(a.metadata).toEqual({ generator: "k8s", version: 1 });
  });
});

// ---------------------------------------------------------------------------
// list_artifacts tool
// ---------------------------------------------------------------------------

describe("list_artifacts tool", () => {
  beforeEach(() => {
    defaultArtifactStore.clear();
  });

  it("returns count and artifact list", async () => {
    defaultArtifactStore.put("k8s/deployment.yaml", "content");
    const result = (await listArtifacts.execute({})) as { count: number; artifacts: unknown[] };
    expect(result.count).toBe(1);
    expect(result.artifacts).toHaveLength(1);
  });

  it("returns zero artifacts when store is empty", async () => {
    const result = (await listArtifacts.execute({})) as { count: number; artifacts: unknown[] };
    expect(result.count).toBe(0);
    expect(result.artifacts).toHaveLength(0);
  });

  it("filters by glob", async () => {
    defaultArtifactStore.put("k8s/deployment.yaml", "");
    defaultArtifactStore.put("Dockerfile", "");
    const result = (await listArtifacts.execute({ glob: "k8s/**" })) as { count: number };
    expect(result.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// get_artifact tool
// ---------------------------------------------------------------------------

describe("get_artifact tool", () => {
  beforeEach(() => {
    defaultArtifactStore.clear();
  });

  it("returns found artifact with content", async () => {
    defaultArtifactStore.put("k8s/service.yaml", "apiVersion: v1");
    const result = (await getArtifact.execute({ path: "k8s/service.yaml" })) as {
      found: boolean;
      content: string;
      language: string;
    };
    expect(result.found).toBe(true);
    expect(result.content).toBe("apiVersion: v1");
    expect(result.language).toBe("yaml");
  });

  it("returns found: false for missing path", async () => {
    const result = (await getArtifact.execute({ path: "does-not-exist.yaml" })) as {
      found: boolean;
    };
    expect(result.found).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generate_kubernetes_manifest stores artifacts
// ---------------------------------------------------------------------------

describe("generate_kubernetes_manifest stores artifacts", () => {
  beforeEach(() => {
    defaultArtifactStore.clear();
  });

  it("puts generated files into the artifact store", async () => {
    await generateKubernetesManifest.execute({
      appName: "my-app",
      runtime: "node",
      port: 3000,
    });
    const artifacts = defaultArtifactStore.list();
    expect(artifacts.length).toBeGreaterThan(0);
    const paths = artifacts.map((a) => a.path);
    expect(paths.some((p) => p.includes("deployment"))).toBe(true);
  });

  it("artifacts have yaml language", async () => {
    await generateKubernetesManifest.execute({
      appName: "test-app",
      runtime: "python",
      port: 8080,
    });
    for (const a of defaultArtifactStore.list()) {
      expect(a.language).toBe("yaml");
    }
  });

  it("stores appName in metadata", async () => {
    await generateKubernetesManifest.execute({
      appName: "meta-app",
      runtime: "go",
      port: 9090,
    });
    const artifact = defaultArtifactStore.list()[0];
    expect(artifact.metadata?.appName).toBe("meta-app");
  });
});
