/**
 * @module @kickstart/core/filesystem/cloud-shell-provider
 *
 * FileSystemProvider backed by Azure Cloud Shell's REST API.
 * Uses an APIConnector for authentication and HTTP transport.
 */

import type { APIConnector } from "../connectors/types.js";
import type { FileEntry, FileSystemProvider } from "./types.js";
import { FileNotFoundError } from "./types.js";
import { sanitizePath } from "./path-utils.js";

/**
 * Cloud Shell filesystem provider.
 *
 * Routes file operations through the Cloud Shell console API.
 * All paths are scoped under `basePath` (default: user home directory).
 *
 * The connector must already be authenticated before calling any method.
 */
export class CloudShellProvider implements FileSystemProvider {
  readonly name = "cloud-shell";

  constructor(
    private readonly connector: APIConnector,
    private readonly basePath: string = "/home",
  ) {}

  /** Resolve a relative path to the full Cloud Shell path. */
  private resolve(relativePath: string): string {
    const safe = sanitizePath(relativePath);
    const base = this.basePath.endsWith("/")
      ? this.basePath.slice(0, -1)
      : this.basePath;
    // Encode each segment while preserving forward slashes
    const encoded = safe
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    return `${base}/${encoded}`;
  }

  async read(path: string): Promise<string> {
    const fullPath = this.resolve(path);
    const res = await this.connector.request("GET", `/api/fs${fullPath}`);
    if (!res.ok) {
      if (res.status === 404) {
        throw new FileNotFoundError(path);
      }
      throw new Error(`Cloud Shell read failed: ${res.status} ${res.statusText}`);
    }
    return await res.text();
  }

  async write(path: string, content: string): Promise<void> {
    const fullPath = this.resolve(path);
    const res = await this.connector.request("PUT", `/api/fs${fullPath}`, { content }, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Cloud Shell write failed: ${res.status} ${res.statusText}`);
    }
  }

  async list(directory: string): Promise<FileEntry[]> {
    const dir =
      directory === "" || directory === "."
        ? this.basePath
        : this.resolve(directory);

    const res = await this.connector.request("GET", `/api/fs${dir}?list=true`);
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`Cloud Shell list failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as Array<{
      name: string;
      type: string;
      size?: number;
      modifiedAt?: string;
    }>;

    const prefix =
      directory === "" || directory === "."
        ? ""
        : sanitizePath(directory) + "/";

    return data.map((item) => ({
      path: prefix + item.name,
      type: item.type === "directory" ? "directory" : "file",
      size: item.size,
      modifiedAt: item.modifiedAt,
    }));
  }

  async delete(path: string): Promise<void> {
    const fullPath = this.resolve(path);
    const res = await this.connector.request("DELETE", `/api/fs${fullPath}`);
    // 404 is acceptable — "no-op if not found"
    if (!res.ok && res.status !== 404) {
      throw new Error(`Cloud Shell delete failed: ${res.status} ${res.statusText}`);
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      const fullPath = this.resolve(path);
      const res = await this.connector.request("GET", `/api/fs${fullPath}`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
