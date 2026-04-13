/**
 * @module @kickstart/core/filesystem/types
 *
 * FileSystemProvider interface and related types for the pluggable
 * filesystem abstraction.  Providers implement read/write/list/delete
 * over arbitrary backends (Cloud Shell, in-memory, local FS, etc.).
 */

/** Metadata for a file or directory entry. */
export interface FileEntry {
  /** Relative forward-slash path (e.g. "k8s/deployment.yaml"). */
  path: string;
  /** Whether this entry is a file or directory. */
  type: "file" | "directory";
  /** Size in bytes (files only). */
  size?: number;
  /** Last-modified timestamp as ISO 8601 string. */
  modifiedAt?: string;
}

/**
 * A pluggable filesystem backend.
 *
 * All paths are forward-slash relative (e.g. "src/index.ts").
 * Providers resolve them against their own root.  Paths containing
 * ".." segments or leading "/" are rejected.
 */
export interface FileSystemProvider {
  /** Provider identifier, e.g. "cloud-shell", "in-memory". */
  readonly name: string;

  /** Read file contents as a UTF-8 string.  Throws if not found. */
  read(path: string): Promise<string>;

  /** Write (create or overwrite) a file. */
  write(path: string, content: string): Promise<void>;

  /** List entries in a directory. */
  list(directory: string): Promise<FileEntry[]>;

  /** Delete a file.  No-op if it does not exist. */
  delete(path: string): Promise<void>;

  /** Check whether a file exists. */
  exists(path: string): Promise<boolean>;
}

/** Error thrown when a file is not found. */
export class FileNotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`File not found: ${path}`);
    this.name = "FileNotFoundError";
  }
}

/** Error thrown when a path is invalid (traversal, absolute, etc.). */
export class InvalidPathError extends Error {
  constructor(public readonly path: string, reason: string) {
    super(`Invalid path "${path}": ${reason}`);
    this.name = "InvalidPathError";
  }
}
