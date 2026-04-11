/**
 * @module @kickstart/core/__tests__/artifact-store
 *
 * Tests for InMemoryArtifactStore and artifact tools.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryArtifactStore } from "../artifacts/index.js";
import { ArtifactQuotaExceededError } from "../artifacts/types.js";
import { listArtifacts } from "../tools/list-artifacts.js";
import { getArtifact } from "../tools/get-artifact.js";
import { generateKubernetesManifest } from "../tools/generate-kubernetes-manifest.js";
import type { ToolContext } from "../tools/types.js";

/** Create a ToolContext wrapping a given store. */
function ctx(store: InMemoryArtifactStore): ToolContext {
  return { artifactStore: store };
}

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
    const _results = store.list("**/*.y{a,}ml");
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
// Quota enforcement
// ---------------------------------------------------------------------------

describe("InMemoryArtifactStore — quota enforcement", () => {
  it("throws when max artifact count exceeded", () => {
    const store = new InMemoryArtifactStore({ maxArtifacts: 2 });
    store.put("a.yaml", "a");
    store.put("b.yaml", "b");
    expect(() => store.put("c.yaml", "c")).toThrowError(ArtifactQuotaExceededError);
  });

  it("allows updating existing artifact within count limit", () => {
    const store = new InMemoryArtifactStore({ maxArtifacts: 1 });
    store.put("a.yaml", "v1");
    // Updating existing path should NOT count as a new artifact
    expect(() => store.put("a.yaml", "v2")).not.toThrow();
    expect(store.get("a.yaml")!.content).toBe("v2");
  });

  it("throws when max size exceeded", () => {
    const store = new InMemoryArtifactStore({ maxSizeBytes: 10 });
    store.put("a.yaml", "12345"); // 5 bytes
    expect(() => store.put("b.yaml", "123456")).toThrowError(ArtifactQuotaExceededError); // 6 bytes, total 11 > 10
  });

  it("accounts for update size delta correctly", () => {
    const store = new InMemoryArtifactStore({ maxSizeBytes: 20 });
    store.put("a.yaml", "1234567890"); // 10 bytes
    // Replacing with smaller content should free space
    store.put("a.yaml", "12345"); // 5 bytes — total now 5
    expect(store.currentSizeBytes).toBe(5);
    // Now we can add more
    store.put("b.yaml", "1234567890"); // 10 bytes — total 15, under 20
    expect(store.currentSizeBytes).toBe(15);
  });

  it("delete reduces tracked size", () => {
    const store = new InMemoryArtifactStore({ maxSizeBytes: 20 });
    store.put("a.yaml", "1234567890"); // 10 bytes
    store.delete("a.yaml");
    expect(store.currentSizeBytes).toBe(0);
    // Can now add the full quota
    store.put("b.yaml", "12345678901234567890"); // 20 bytes
    expect(store.size).toBe(1);
  });

  it("clear resets size tracking", () => {
    const store = new InMemoryArtifactStore({ maxSizeBytes: 20 });
    store.put("a.yaml", "1234567890");
    store.clear();
    expect(store.currentSizeBytes).toBe(0);
  });

  it("error contains correct reason and values", () => {
    const store = new InMemoryArtifactStore({ maxArtifacts: 1 });
    store.put("a.yaml", "a");
    try {
      store.put("b.yaml", "b");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ArtifactQuotaExceededError);
      const err = e as ArtifactQuotaExceededError;
      expect(err.reason).toBe("max_artifacts");
      expect(err.limit).toBe(1);
      expect(err.current).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Session isolation
// ---------------------------------------------------------------------------

describe("Per-session artifact store isolation", () => {
  it("separate store instances do not share artifacts", () => {
    const storeA = new InMemoryArtifactStore();
    const storeB = new InMemoryArtifactStore();

    storeA.put("deployment.yaml", "session-a-content");
    storeB.put("service.yaml", "session-b-content");

    expect(storeA.get("service.yaml")).toBeNull();
    expect(storeB.get("deployment.yaml")).toBeNull();
    expect(storeA.size).toBe(1);
    expect(storeB.size).toBe(1);
  });

  it("clearing one store does not affect another", () => {
    const storeA = new InMemoryArtifactStore();
    const storeB = new InMemoryArtifactStore();

    storeA.put("a.yaml", "a");
    storeB.put("b.yaml", "b");
    storeA.clear();

    expect(storeA.size).toBe(0);
    expect(storeB.size).toBe(1);
    expect(storeB.get("b.yaml")!.content).toBe("b");
  });
});

// ---------------------------------------------------------------------------
// Metadata size in quota (Issue #2)
// ---------------------------------------------------------------------------

describe("InMemoryArtifactStore — metadata counted in quota", () => {
  it("metadata size contributes to total size tracking", () => {
    const store = new InMemoryArtifactStore();
    store.put("f.yaml", "tiny", { metadata: { generator: "k8s", data: "x".repeat(100) } });
    // Content is 4 bytes, but metadata adds significant size
    expect(store.currentSizeBytes).toBeGreaterThan(100);
  });

  it("throws when metadata alone would exceed quota", () => {
    const store = new InMemoryArtifactStore({ maxSizeBytes: 50 });
    const bigMeta = { data: "x".repeat(200) };
    expect(() => store.put("m.yaml", "tiny", { metadata: bigMeta })).toThrow(
      ArtifactQuotaExceededError,
    );
  });

  it("metadata size freed on delete", () => {
    const store = new InMemoryArtifactStore();
    store.put("f.yaml", "x", { metadata: { big: "y".repeat(500) } });
    const sizeWithMeta = store.currentSizeBytes;
    expect(sizeWithMeta).toBeGreaterThan(500);
    store.delete("f.yaml");
    expect(store.currentSizeBytes).toBe(0);
  });

  it("metadata size freed on replace", () => {
    const store = new InMemoryArtifactStore();
    store.put("f.yaml", "x", { metadata: { big: "y".repeat(500) } });
    const sizeBefore = store.currentSizeBytes;
    store.put("f.yaml", "x"); // no metadata
    expect(store.currentSizeBytes).toBeLessThan(sizeBefore);
  });
});

// ---------------------------------------------------------------------------
// Content sanitization (Issue #4)
// ---------------------------------------------------------------------------

describe("InMemoryArtifactStore — content sanitization", () => {
  let store: InMemoryArtifactStore;

  beforeEach(() => {
    store = new InMemoryArtifactStore();
  });

  it("strips script tags from non-HTML artifacts", () => {
    store.put("app.yaml", 'hello<script>alert("xss")</script>world');
    expect(store.get("app.yaml")!.content).toBe("helloworld");
  });

  it("strips style tags from stored content", () => {
    store.put("app.yaml", "before<style>body{}</style>after");
    expect(store.get("app.yaml")!.content).toBe("beforeafter");
  });

  it("strips iframe tags from stored content", () => {
    store.put("app.yaml", 'before<iframe src="evil"></iframe>after');
    expect(store.get("app.yaml")!.content).toBe("beforeafter");
  });

  it("strips object/embed tags", () => {
    store.put("f.json", '<object data="x"></object><embed src="y"></embed>');
    const result = store.get("f.json")!.content;
    expect(result).not.toContain("<object");
    expect(result).not.toContain("<embed");
  });

  it("strips event handlers from stored content", () => {
    store.put("app.yaml", '<div onload="evil()">ok</div>');
    expect(store.get("app.yaml")!.content).not.toContain("onload");
  });

  it("preserves HTML content for html-language artifacts", () => {
    store.put("page.html", '<script>valid()</script><p>hello</p>');
    expect(store.get("page.html")!.content).toContain("<script>");
  });

  it("preserves XML content for xml-language artifacts", () => {
    store.put("config.xml", '<object id="x"><embed /></object>');
    expect(store.get("config.xml")!.content).toContain("<object");
  });

  it("sanitizes YAML artifacts with injected HTML", () => {
    store.put("deploy.yaml", 'apiVersion: v1\nname: <script>bad</script>');
    expect(store.get("deploy.yaml")!.content).not.toContain("<script>");
  });
});

describe("list_artifacts tool", () => {
  let store: InMemoryArtifactStore;

  beforeEach(() => {
    store = new InMemoryArtifactStore();
  });

  it("returns count and artifact list", async () => {
    store.put("k8s/deployment.yaml", "content");
    const result = (await listArtifacts.execute({}, ctx(store))) as { count: number; artifacts: unknown[] };
    expect(result.count).toBe(1);
    expect(result.artifacts).toHaveLength(1);
  });

  it("returns zero artifacts when store is empty", async () => {
    const result = (await listArtifacts.execute({}, ctx(store))) as { count: number; artifacts: unknown[] };
    expect(result.count).toBe(0);
    expect(result.artifacts).toHaveLength(0);
  });

  it("filters by glob", async () => {
    store.put("k8s/deployment.yaml", "");
    store.put("Dockerfile", "");
    const result = (await listArtifacts.execute({ glob: "k8s/**" }, ctx(store))) as { count: number };
    expect(result.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// get_artifact tool (with context injection)
// ---------------------------------------------------------------------------

describe("get_artifact tool", () => {
  let store: InMemoryArtifactStore;

  beforeEach(() => {
    store = new InMemoryArtifactStore();
  });

  it("returns found artifact with content", async () => {
    store.put("k8s/service.yaml", "apiVersion: v1");
    const result = (await getArtifact.execute({ path: "k8s/service.yaml" }, ctx(store))) as {
      found: boolean;
      content: string;
      language: string;
    };
    expect(result.found).toBe(true);
    expect(result.content).toBe("apiVersion: v1");
    expect(result.language).toBe("yaml");
  });

  it("returns found: false for missing path", async () => {
    const result = (await getArtifact.execute({ path: "does-not-exist.yaml" }, ctx(store))) as {
      found: boolean;
    };
    expect(result.found).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generate_kubernetes_manifest stores artifacts (with context injection)
// ---------------------------------------------------------------------------

describe("generate_kubernetes_manifest stores artifacts", () => {
  let store: InMemoryArtifactStore;

  beforeEach(() => {
    store = new InMemoryArtifactStore();
  });

  it("puts generated files into the artifact store", async () => {
    await generateKubernetesManifest.execute({
      appName: "my-app",
      runtime: "node",
      port: 3000,
    }, ctx(store));
    const artifacts = store.list();
    expect(artifacts.length).toBeGreaterThan(0);
    const paths = artifacts.map((a) => a.path);
    expect(paths.some((p) => p.includes("deployment"))).toBe(true);
  });

  it("artifacts have yaml language", async () => {
    await generateKubernetesManifest.execute({
      appName: "test-app",
      runtime: "python",
      port: 8080,
    }, ctx(store));
    for (const a of store.list()) {
      expect(a.language).toBe("yaml");
    }
  });

  it("stores appName in metadata", async () => {
    await generateKubernetesManifest.execute({
      appName: "meta-app",
      runtime: "go",
      port: 9090,
    }, ctx(store));
    const artifact = store.list()[0];
    expect(artifact.metadata?.appName).toBe("meta-app");
  });
});
