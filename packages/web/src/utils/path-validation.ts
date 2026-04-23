/**
 * Strict file-path validation and normalization for the virtual filesystem.
 *
 * All user-supplied file paths must pass through `normalizePath()` before
 * any filesystem operation. Returns the canonical relative path on success,
 * or `null` on rejection.
 */

const MAX_PATH_LENGTH = 260;
const MAX_SEGMENT_LENGTH = 255;
const MAX_PATH_DEPTH = 15;

/** Only alphanumeric, dot, dash, underscore, and forward slash. */
const SEGMENT_ALLOWLIST = /^[a-zA-Z0-9._-]+$/;

/** Control characters: codepoints < 0x20, DEL (0x7F), and null bytes. */
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

/** Reserved characters that are unsafe on Windows or in paths. */
const RESERVED_CHARS = /[<>:"|?*\\]/;

export interface PathValidationError {
  code:
    | 'EMPTY_PATH'
    | 'ABSOLUTE_PATH'
    | 'DOT_DOT_TRAVERSAL'
    | 'CONTROL_CHARS'
    | 'RESERVED_CHARS'
    | 'PATH_TOO_LONG'
    | 'SEGMENT_TOO_LONG'
    | 'PATH_TOO_DEEP'
    | 'INVALID_SEGMENT_CHARS';
  message: string;
}

/**
 * Validate and normalize a user-supplied file path.
 *
 * @returns The canonical relative path, or `null` if the path is invalid.
 */
export function normalizePath(input: string): string | null {
  const error = validatePath(input);
  if (error) return null;
  return sanitizePath(input);
}

/**
 * Validate a path and return an error descriptor, or `null` if valid.
 * Use this when you need the specific error reason for user-facing messages.
 */
export function validatePath(input: string): PathValidationError | null {
  if (!input || input.trim().length === 0) {
    return { code: 'EMPTY_PATH', message: 'Path cannot be empty' };
  }

  // Reject control characters (check raw input before normalization)
  if (CONTROL_CHARS.test(input)) {
    return { code: 'CONTROL_CHARS', message: 'Path contains control characters' };
  }

  // Reject reserved characters
  if (RESERVED_CHARS.test(input)) {
    return { code: 'RESERVED_CHARS', message: 'Path contains reserved characters (<>:"|?*\\)' };
  }

  // Reject absolute paths (drive letters like C:\, or leading /)
  const trimmed = input.trim();
  if (/^[a-zA-Z]:/.test(trimmed)) {
    return { code: 'ABSOLUTE_PATH', message: 'Absolute paths are not allowed' };
  }

  // Normalize separators for further checks
  const normalized = sanitizePath(trimmed);
  if (!normalized || normalized.length === 0) {
    return { code: 'EMPTY_PATH', message: 'Path is empty after normalization' };
  }

  // Reject absolute paths (leading /)
  if (trimmed.startsWith('/')) {
    return { code: 'ABSOLUTE_PATH', message: 'Absolute paths are not allowed' };
  }

  // Split into segments
  const segments = normalized.split('/');

  // Reject dot-dot traversal
  for (const seg of segments) {
    if (seg === '..' || seg.includes('..')) {
      return { code: 'DOT_DOT_TRAVERSAL', message: 'Path traversal ("..") is not allowed' };
    }
  }

  // Enforce max path length
  if (normalized.length > MAX_PATH_LENGTH) {
    return { code: 'PATH_TOO_LONG', message: `Path exceeds maximum length of ${MAX_PATH_LENGTH} characters` };
  }

  // Enforce max path depth
  if (segments.length > MAX_PATH_DEPTH) {
    return { code: 'PATH_TOO_DEEP', message: `Path exceeds maximum depth of ${MAX_PATH_DEPTH} segments` };
  }

  // Check each segment
  for (const seg of segments) {
    if (seg.length > MAX_SEGMENT_LENGTH) {
      return { code: 'SEGMENT_TOO_LONG', message: `Segment "${seg.slice(0, 20)}…" exceeds maximum length of ${MAX_SEGMENT_LENGTH} characters` };
    }
    if (!SEGMENT_ALLOWLIST.test(seg)) {
      return { code: 'INVALID_SEGMENT_CHARS', message: `Segment "${seg}" contains invalid characters (only a-z, A-Z, 0-9, '.', '-', '_' allowed)` };
    }
  }

  return null;
}

/** Internal: normalize separators and strip leading ./ */
function sanitizePath(raw: string): string {
  return raw
    .trim()
    .replace(/\\/g, '/')        // backslash → forward slash
    .replace(/^\.\//, '')        // strip leading ./
    .replace(/^\/+/, '')         // strip leading slashes
    .replace(/\/+/g, '/')        // collapse repeated slashes
    .replace(/\/+$/, '');         // strip trailing slashes
}
