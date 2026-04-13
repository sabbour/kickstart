/**
 * @module @kickstart/core/filesystem/in-memory-provider
 *
 * In-memory FileSystemProvider for tests and web-frontend use.
 * All operations resolve immediately — no I/O.
 */

import type { FileEntry, FileSystemProvider } from "./types.js";
import { FileNotFoundError } from "./types.js";
import { sanitizePath } from "./path-utils.js";

export class InMemoryFileSystemProvider implements FileSystemProvider {
  readonly name = "in-memory";

  private readonly files = new Map<string, { content: string; updatedAt: Date }>();

  async read(path: string): Promise<string> {
    const key = sanitizePath(path);
    const entry = this.files.get(key);
    if (!entry) {
      throw new FileNotFoundError(key);
    }
    return entry.content;
  }

  async write(path: string, content: string): Promise<void> {
    const key = sanitizePath(path);
    this.files.set(key, { content, updatedAt: new Date() });
  }

  async list(directory: string): Promise<FileEntry[]> {
    // Allow empty string or "." for root listing
    const dir =
      directory === "" || directory === "."
        ? ""
        : sanitizePath(directory) + "/";

    const seen = new Set<string>();
    const entries: FileEntry[] = [];

    for (const [filePath, meta] of this.files) {
      if (!filePath.startsWith(dir)) continue;

      const remainder = filePath.slice(dir.length);
      const slashIdx = remainder.indexOf("/");

      if (slashIdx === -1) {
        // Direct child file
        entries.push({
          path: filePath,
          type: "file",
          size: new TextEncoder().encode(meta.content).byteLength,
          modifiedAt: meta.updatedAt.toISOString(),
        });
      } else {
        // Child directory — only emit once
        const childDir = dir + remainder.slice(0, slashIdx);
        if (!seen.has(childDir)) {
          seen.add(childDir);
          entries.push({ path: childDir, type: "directory" });
        }
      }
    }

    return entries;
  }

  async delete(path: string): Promise<void> {
    const key = sanitizePath(path);
    this.files.delete(key);
  }

  async exists(path: string): Promise<boolean> {
    const key = sanitizePath(path);
    return this.files.has(key);
  }

  /** Number of files stored (test helper). */
  get size(): number {
    return this.files.size;
  }

  /** Remove all files (test helper). */
  clear(): void {
    this.files.clear();
  }
}
