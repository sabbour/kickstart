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

/** Interface for an artifact store — read/write generated files. */
export interface ArtifactStore {
  /**
   * Store an artifact. Creates or replaces the file at `path`.
   * `language` defaults to the file extension if omitted.
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
