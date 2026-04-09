/**
 * @module @kickstart/core/artifacts/in-memory
 *
 * InMemoryArtifactStore — default artifact store implementation.
 * Holds all artifacts in a Map; no persistence across page reloads.
 */

import type { Artifact, ArtifactStore } from "./types.js";

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

  put(
    path: string,
    content: string,
    metadata?: Omit<Partial<Artifact>, "path" | "content" | "createdAt" | "updatedAt">
  ): void {
    const existing = this.store.get(path);
    const now = new Date();
    this.store.set(path, {
      path,
      content,
      language: metadata?.language ?? existing?.language ?? inferLanguage(path),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      metadata: metadata?.metadata,
    });
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
    this.store.delete(path);
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
  }

  /** Number of stored artifacts (useful in tests). */
  get size(): number {
    return this.store.size;
  }
}

/** Singleton default artifact store. Shared by all tools in the same process. */
export const defaultArtifactStore = new InMemoryArtifactStore();
