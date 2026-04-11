/**
 * @module @kickstart/core/artifacts/types
 *
 * Artifact type and ArtifactStore interface.
 * Artifacts are generated files (K8s manifests, Dockerfiles, CI workflows, etc.)
 * produced by the conversation engine and LLM tools.
 */

/** A single generated file artifact. */
export interface Artifact {
  /** Relative path — e.g. "k8s/deployment.yaml", "Dockerfile", ".github/workflows/deploy.yml" */
  path: string;
  /** Full file content */
  content: string;
  /** Language hint for syntax highlighting — e.g. "yaml", "dockerfile", "typescript" */
  language: string;
  createdAt: Date;
  updatedAt: Date;
  /** Optional free-form metadata (generator name, session ID, etc.) */
  metadata?: Record<string, unknown>;
}

/** Per-session quota limits for artifact storage. */
export interface ArtifactStoreQuota {
  /** Maximum number of artifacts allowed in this store. */
  maxArtifacts: number;
  /** Maximum total content size in bytes across all artifacts. */
  maxSizeBytes: number;
}

/** Default quota: 100 artifacts, 10 MB total content. */
export const DEFAULT_ARTIFACT_QUOTA: ArtifactStoreQuota = {
  maxArtifacts: 100,
  maxSizeBytes: 10 * 1024 * 1024,
};

/** Thrown when an artifact write would exceed the store's quota. */
export class ArtifactQuotaExceededError extends Error {
  constructor(
    public readonly reason: "max_artifacts" | "max_size",
    public readonly limit: number,
    public readonly current: number,
  ) {
    const what = reason === "max_artifacts" ? "artifact count" : "total size (bytes)";
    super(`Artifact quota exceeded: ${what} limit is ${limit}, current is ${current}`);
    this.name = "ArtifactQuotaExceededError";
  }
}

/** Interface for an artifact store — read/write generated files. */
export interface ArtifactStore {
  /**
   * Store an artifact. Creates or replaces the file at `path`.
   * `language` defaults to the file extension if omitted.
   * Throws `ArtifactQuotaExceededError` if the write would exceed quota limits.
   */
  put(
    path: string,
    content: string,
    metadata?: Omit<Partial<Artifact>, "path" | "content" | "createdAt" | "updatedAt">
  ): void;

  /** Retrieve an artifact by path. Returns null if not found. */
  get(path: string): Artifact | null;

  /**
   * List artifacts, optionally filtered by a glob-style pattern.
   * Supports `*` (any chars within a segment) and `**` (any chars across segments).
   * Returns all artifacts when pattern is omitted.
   */
  list(glob?: string): Artifact[];

  /** Delete an artifact by path. No-op if not found. */
  delete(path: string): void;

  /**
   * Export all artifacts as a plain object mapping path → content.
   * Useful for creating zip archives or sending to the client.
   */
  export(): Record<string, string>;

  /** Remove all stored artifacts. */
  clear(): void;
}
