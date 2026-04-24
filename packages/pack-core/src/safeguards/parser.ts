/**
 * Safe YAML parser for Kubernetes manifests.
 *
 * Security constraints (Zapp conditions):
 *   - Uses safe load (no custom tags, no eval).
 *   - Enforces input bounds: document count, nesting depth, total bytes.
 *   - Never invokes shell, helm template, or kustomize build.
 */

import { parseAllDocuments, isMap, isSeq, isScalar, type Document } from 'yaml';

// ── Input bounds (Zapp security conditions) ─────────────────────────────────

/** Maximum number of YAML documents in a single manifest input. */
export const MAX_DOCUMENT_COUNT = 50;

/** Maximum total input bytes. */
export const MAX_INPUT_BYTES = 2 * 1024 * 1024; // 2 MB

/** Maximum YAML nesting depth. */
export const MAX_NESTING_DEPTH = 64;

/** Maximum YAML alias count (prevents billion-laughs attacks). */
export const MAX_ALIAS_COUNT = 100;

// ── Depth check ─────────────────────────────────────────────────────────────

function measureDepth(node: unknown, current: number): number {
  if (current > MAX_NESTING_DEPTH) return current;
  if (node == null || typeof node !== 'object') return current;

  if (isMap(node)) {
    let max = current;
    for (const pair of node.items) {
      max = Math.max(max, measureDepth(pair.value, current + 1));
    }
    return max;
  }
  if (isSeq(node)) {
    let max = current;
    for (const item of node.items) {
      max = Math.max(max, measureDepth(item, current + 1));
    }
    return max;
  }
  if (isScalar(node)) {
    return current;
  }

  if (Array.isArray(node)) {
    let max = current;
    for (const item of node) {
      max = Math.max(max, measureDepth(item, current + 1));
    }
    return max;
  }
  let max = current;
  for (const val of Object.values(node as Record<string, unknown>)) {
    max = Math.max(max, measureDepth(val, current + 1));
  }
  return max;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ParseResult {
  ok: true;
  documents: Array<Record<string, unknown>>;
}

export interface ParseError {
  ok: false;
  error: string;
}

/**
 * Parse multi-document YAML manifest text into plain JS objects.
 * Returns an error result (never throws) when safety bounds are exceeded.
 */
export function parseManifest(text: string): ParseResult | ParseError {
  const bytes = Buffer.byteLength(text, 'utf-8');
  if (bytes > MAX_INPUT_BYTES) {
    return { ok: false, error: `Input exceeds ${MAX_INPUT_BYTES} byte limit (got ${bytes})` };
  }

  const aliasCount = (text.match(/\*[a-zA-Z_][a-zA-Z0-9_]*/g) ?? []).length;
  if (aliasCount > MAX_ALIAS_COUNT) {
    return { ok: false, error: `Too many YAML aliases (${aliasCount} > ${MAX_ALIAS_COUNT})` };
  }

  let docs: Document[];
  try {
    docs = parseAllDocuments(text);
  } catch (err) {
    return { ok: false, error: `YAML parse error: ${(err as Error).message}` };
  }

  if (docs.length > MAX_DOCUMENT_COUNT) {
    return { ok: false, error: `Too many YAML documents (${docs.length} > ${MAX_DOCUMENT_COUNT})` };
  }

  const result: Array<Record<string, unknown>> = [];

  for (const doc of docs) {
    if (doc.errors.length > 0) {
      return { ok: false, error: `YAML parse error: ${doc.errors[0].message}` };
    }

    if (doc.contents) {
      const depth = measureDepth(doc.contents, 0);
      if (depth > MAX_NESTING_DEPTH) {
        return { ok: false, error: `YAML nesting depth exceeds ${MAX_NESTING_DEPTH}` };
      }
    }

    const obj = doc.toJSON();
    if (obj == null) continue;
    if (typeof obj !== 'object' || Array.isArray(obj)) continue;

    result.push(obj as Record<string, unknown>);
  }

  return { ok: true, documents: result };
}
