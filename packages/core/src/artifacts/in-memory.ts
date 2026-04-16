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

/** Compute total byte size of metadata using JSON serialization. */
function metadataSizeBytes(metadata?: Record<string, unknown>): number {
  if (metadata === undefined) return 0;
  try {
    return new TextEncoder().encode(JSON.stringify(metadata)).byteLength;
  } catch {
    return 256; // conservative fallback for non-serializable metadata
  }
}

/** Compute total byte size of an artifact (content + metadata). */
function artifactSizeBytes(content: string, metadata?: Record<string, unknown>): number {
  return contentSizeBytes(content) + metadataSizeBytes(metadata);
}

/**
 * Convert a glob pattern to a RegExp.
 * Supports `*` (matches within a path segment) and `**` (matches across segments).
 *
 * Uses segment-aware replacements (`[^/]+`, `[^/]*`) instead of `.*` to
 * prevent polynomial ReDoS from adjacent unbounded quantifiers (CodeQL alert).
 * Input is validated to guard against patterns that could still produce slow
 * regex even with the safer quantifiers.
 */
function globToRegExp(pattern: string): RegExp {
  if (pattern.length > 256) {
    throw new Error(`Glob pattern too long (max 256 characters): "${pattern.slice(0, 40)}…"`);
  }
  const doubleStars = (pattern.match(/\*\*/g) ?? []).length;
  if (doubleStars > 8) {
    throw new Error(`Glob pattern contains too many '**' wildcards (max 8)`);
  }

  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape regex specials (except * and ?)
    .replace(/\*\*/g, "\x00")              // placeholder for **
    .replace(/\*/g, "[^/]*")              // * → within-segment wildcard (no slash)
    // ** replacements use [^/]+ (no slash) to prevent overlapping quantifiers:
    .replace(/\x00\//g, "(?:[^/]+/)*")    // **/ → zero or more "segment/" prefixes
    .replace(/\/\x00/g, "(?:/[^/]+)*")   // /** → zero or more "/segment" suffixes
    .replace(/\x00/g, "(?:[^/]+/)*[^/]*"); // standalone ** → any path segments
  return new RegExp(`^${escaped}$`);
}

// ---------------------------------------------------------------------------
// Content sanitization — strip dangerous HTML/JS injection vectors on store.
// Artifacts are code/config (YAML, Dockerfiles, etc.), not HTML documents.
// ---------------------------------------------------------------------------

/**
 * Attribute-aware HTML tag pattern.
 * Uses `(?:[^>"']|"[^"]*"|'[^']*')*` so that `>` inside a quoted attribute
 * value does not prematurely end the match (CodeQL bad-tag-filter fix).
 */
const HTML_TAG_RE = /<(?:[^>"']|"[^"]*"|'[^']*')*>/g;

/**
 * Matches script/style blocks including content via a back-reference.
 * Replaces the previous chain of per-tag removes that was bypassable through
 * nested/interleaved tag injection (CodeQL incomplete-sanitization fix).
 */
const SCRIPT_STYLE_BLOCK_RE =
  /<(script|style)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>/gi;

/**
 * Sanitize artifact content: strip script/style blocks and all HTML tags.
 * Only applied to non-HTML artifacts (YAML, JSON, Dockerfiles, etc.).
 */
function sanitizeContent(content: string): string {
  return content
    .replace(SCRIPT_STYLE_BLOCK_RE, "")
    .replace(HTML_TAG_RE, "");
}

/** Languages whose content legitimately contains HTML-like tags. */
const HTML_LANGUAGES = new Set(["html", "svg", "xml"]);

export class InMemoryArtifactStore implements ArtifactStore {
  private readonly store = new Map<string, Artifact>();
  private readonly quota: ArtifactStoreQuota;
  /** Running total of content + metadata bytes for O(1) quota enforcement. */
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
    const language = metadata?.language ?? existing?.language ?? inferLanguage(path);

    // Sanitize content — skip for HTML/XML/SVG where tags are legitimate
    const safeContent = HTML_LANGUAGES.has(language) ? content : sanitizeContent(content);

    const newSize = artifactSizeBytes(safeContent, metadata?.metadata);
    const oldSize = existing ? artifactSizeBytes(existing.content, existing.metadata) : 0;

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
      content: safeContent,
      language,
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
      this.totalSizeBytes -= artifactSizeBytes(existing.content, existing.metadata);
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

  /** Current total content + metadata size in bytes. */
  get currentSizeBytes(): number {
    return this.totalSizeBytes;
  }
}

/**
 * Singleton default artifact store for web (single session per page load).
 * MCP server MUST NOT use this — each session gets its own InMemoryArtifactStore.
 */
export const defaultArtifactStore = new InMemoryArtifactStore();
