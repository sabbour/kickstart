/**
 * @module @kickstart/core/artifacts/in-memory
 *
 * InMemoryArtifactStore — default artifact store implementation.
 * Holds all artifacts in a Map; no persistence across page reloads.
 * Supports per-session quota enforcement to prevent memory DoS.
 */

import type { Artifact, ArtifactStore, ArtifactStoreQuota } from "./types.js";
import { ArtifactQuotaExceededError, DEFAULT_ARTIFACT_QUOTA } from "./types.js";

/** Infer language from a file path extension. */
function inferLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    yaml: "yaml",
    yml: "yaml",
    json: "json",
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    cs: "csharp",
    sh: "bash",
    md: "markdown",
    tf: "hcl",
    bicep: "bicep",
    dockerfile: "dockerfile",
    toml: "toml",
    xml: "xml",
    html: "html",
    css: "css",
  };
  // Special case: file named exactly "Dockerfile"
  if (path.split("/").pop()?.toLowerCase() === "dockerfile") return "dockerfile";
  return map[ext] ?? "plaintext";
}

/** Measure content size in bytes (UTF-8). */
function contentSizeBytes(content: string): number {
  return new TextEncoder().encode(content).byteLength;
}

/**
 * Convert a glob pattern to a RegExp.
 * Supports `*` (matches within a path segment) and `**` (matches across segments).
 */
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape regex specials (except * and ?)
    .replace(/\*\*/g, "\x00") // placeholder for **
    .replace(/\*/g, "[^/]*") // * → match within segment
    .replace(/\x00/g, ".*"); // ** → match across segments
  return new RegExp(`^${escaped}$`);
}

export class InMemoryArtifactStore implements ArtifactStore {
  private readonly store = new Map<string, Artifact>();
  private readonly quota: ArtifactStoreQuota;
  /** Running total of content bytes for O(1) quota enforcement. */
  private totalSizeBytes = 0;

  constructor(quota?: Partial<ArtifactStoreQuota>) {
    this.quota = { ...DEFAULT_ARTIFACT_QUOTA, ...quota };
  }

  put(
    path: string,
    content: string,
    metadata?: Omit<Partial<Artifact>, "path" | "content" | "createdAt" | "updatedAt">
  ): void {
    const existing = this.store.get(path);
    const newSize = contentSizeBytes(content);
    const oldSize = existing ? contentSizeBytes(existing.content) : 0;

    // Quota: artifact count (only enforced for new artifacts, not updates)
    if (!existing && this.store.size >= this.quota.maxArtifacts) {
      throw new ArtifactQuotaExceededError("max_artifacts", this.quota.maxArtifacts, this.store.size);
    }

    // Quota: total content size
    const projectedSize = this.totalSizeBytes - oldSize + newSize;
    if (projectedSize > this.quota.maxSizeBytes) {
      throw new ArtifactQuotaExceededError("max_size", this.quota.maxSizeBytes, projectedSize);
    }

    const now = new Date();
    this.store.set(path, {
      path,
      content,
      language: metadata?.language ?? existing?.language ?? inferLanguage(path),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      metadata: metadata?.metadata,
    });

    this.totalSizeBytes = projectedSize;
  }

  get(path: string): Artifact | null {
    return this.store.get(path) ?? null;
  }

  list(glob?: string): Artifact[] {
    const all = Array.from(this.store.values());
    if (!glob) return all;
    const re = globToRegExp(glob);
    return all.filter((a) => re.test(a.path));
  }

  delete(path: string): void {
    const existing = this.store.get(path);
    if (existing) {
      this.totalSizeBytes -= contentSizeBytes(existing.content);
      this.store.delete(path);
    }
  }

  export(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [path, artifact] of this.store) {
      result[path] = artifact.content;
    }
    return result;
  }

  clear(): void {
    this.store.clear();
    this.totalSizeBytes = 0;
  }

  /** Number of stored artifacts. */
  get size(): number {
    return this.store.size;
  }

  /** Current total content size in bytes. */
  get currentSizeBytes(): number {
    return this.totalSizeBytes;
  }
}

/**
 * Singleton default artifact store for web (single session per page load).
 * MCP server MUST NOT use this — each session gets its own InMemoryArtifactStore.
 */
export const defaultArtifactStore = new InMemoryArtifactStore();
