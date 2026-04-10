/**
 * @module @kickstart/core/tools/github-input-validation
 *
 * Input sanitisation for GitHub repo-analysis tools.
 * Prevents path-traversal attacks and rejects malformed git refs.
 */

/** Characters that must never appear in a file path sent to the GitHub API. */
const FORBIDDEN_PATH_CHARS = /[\x00-\x1f\\]/;

/**
 * Git ref format per git-check-ref-format(1):
 *   - 40-char lowercase hex SHA
 *   - or a branch/tag name: alphanumeric, hyphens, underscores, dots, slashes
 *     (no consecutive dots, no leading/trailing dot or slash, no ".lock" suffix)
 */
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const REF_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-/]*$/;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a file path before sending it to the GitHub Contents API.
 *
 * Rejects:
 *  - Path traversal segments (`..`)
 *  - Absolute paths (leading `/`)
 *  - Null bytes or control characters
 *  - Empty paths
 */
export function validatePath(path: string): ValidationResult {
  if (!path || path.trim().length === 0) {
    return { valid: false, error: "Path must not be empty." };
  }

  if (path.startsWith("/")) {
    return { valid: false, error: "Path must be relative (no leading '/')." };
  }

  if (FORBIDDEN_PATH_CHARS.test(path)) {
    return {
      valid: false,
      error: "Path contains forbidden characters (null bytes or control chars).",
    };
  }

  // Check every segment for path traversal
  const segments = path.split("/");
  for (const seg of segments) {
    if (seg === "..") {
      return {
        valid: false,
        error: "Path traversal ('..') is not allowed.",
      };
    }
    if (seg === ".") {
      return {
        valid: false,
        error: "Current-directory segment ('.') is not allowed in paths.",
      };
    }
  }

  return { valid: true };
}

/**
 * Validate a git ref (branch name, tag, or SHA) before using it in a GitHub API request.
 *
 * Accepts:
 *  - 40-char lowercase hex SHA
 *  - HEAD (literal)
 *  - Branch / tag names matching git-check-ref-format rules
 *
 * Rejects:
 *  - Path traversal in ref (`..`)
 *  - Control characters / null bytes
 *  - Names ending in `.lock`
 *  - Consecutive dots (`..`)
 *  - Leading or trailing slashes / dots
 *  - Whitespace
 */
export function validateRef(ref: string): ValidationResult {
  if (!ref || ref.trim().length === 0) {
    return { valid: false, error: "Ref must not be empty." };
  }

  // HEAD is always valid
  if (ref === "HEAD") {
    return { valid: true };
  }

  // Full SHA
  if (SHA_PATTERN.test(ref)) {
    return { valid: true };
  }

  if (FORBIDDEN_PATH_CHARS.test(ref) || /\s/.test(ref)) {
    return {
      valid: false,
      error: "Ref contains forbidden characters (control chars or whitespace).",
    };
  }

  if (ref.includes("..")) {
    return { valid: false, error: "Ref must not contain '..' (path traversal)." };
  }

  if (ref.endsWith(".lock")) {
    return { valid: false, error: "Ref must not end with '.lock'." };
  }

  if (ref.startsWith("/") || ref.endsWith("/")) {
    return { valid: false, error: "Ref must not start or end with '/'." };
  }

  if (ref.startsWith(".") || ref.endsWith(".")) {
    return { valid: false, error: "Ref must not start or end with '.'." };
  }

  if (!REF_NAME_PATTERN.test(ref)) {
    return {
      valid: false,
      error:
        "Ref contains invalid characters. Only alphanumerics, hyphens, underscores, dots, and slashes are allowed.",
    };
  }

  return { valid: true };
}
