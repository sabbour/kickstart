/**
 * @module @kickstart/core/filesystem/path-utils
 *
 * Path validation and normalisation shared by all filesystem providers.
 * No Node.js dependencies — uses string manipulation only.
 */

import { InvalidPathError } from "./types.js";

/**
 * Validate and normalise a relative forward-slash path.
 *
 * Rejects:
 *  - absolute paths (leading "/")
 *  - traversal segments ("..")
 *  - empty paths
 *  - backslash separators
 *
 * Returns the normalised path with redundant slashes and trailing slash removed.
 */
export function sanitizePath(raw: string): string {
  if (!raw || raw.trim().length === 0) {
    throw new InvalidPathError(raw, "path must not be empty");
  }

  // Reject backslashes — callers should always use forward slashes
  if (raw.includes("\\")) {
    throw new InvalidPathError(raw, "use forward slashes only");
  }

  // Reject absolute paths
  if (raw.startsWith("/")) {
    throw new InvalidPathError(raw, "absolute paths are not allowed");
  }

  // Collapse duplicate slashes, filter out single-dot segments, and trim trailing slash
  const normalised = raw
    .split("/")
    .filter((seg) => seg.length > 0 && seg !== ".")
    .join("/");

  // Reject traversal
  const segments = normalised.split("/");
  for (const seg of segments) {
    if (seg === "..") {
      throw new InvalidPathError(raw, "path traversal (..) is not allowed");
    }
  }

  if (normalised.length === 0) {
    throw new InvalidPathError(raw, "path must not be empty after normalisation");
  }

  return normalised;
}
