/**
 * emitFile — push a named file from a tool to the browser's in-memory store.
 *
 * The file is queued as an A2UI `file` event on the session and drained by the
 * runner into the SSE stream, where the frontend stores it in a
 * `Map<name, content>`. No server filesystem or blob storage is involved.
 */

import type { A2UIMessageV09 as A2UIMessage } from '../types/a2ui.js';
import type { FileMessage } from '../types/a2ui.js';

/**
 * Minimal session contract required by `emitFile`. Using a structural subset
 * rather than the concrete `Session` class makes this callable from any tool
 * context that has a `recordA2UIEmission` method (e.g. `SessionCtx`).
 */
export interface EmitFileSession {
  recordA2UIEmission(msg: A2UIMessage): void;
}

/**
 * Emit a file event on the session so the browser can store it in-memory.
 *
 * @param session  - Any session-like object with `recordA2UIEmission`.
 * @param name     - File name / path key (e.g. `"src/main.ts"`).
 * @param content  - File content as a UTF-8 string.
 * @param mimeType - Optional MIME type (e.g. `"text/typescript"`). Defaults to
 *                   `undefined`; the frontend may fall back to `"text/plain"`.
 */
export function emitFile(
  session: EmitFileSession,
  name: string,
  content: string,
  mimeType?: string,
): void {
  if (content.length > 5_000_000) {
    throw new Error(
      `emitFile: content exceeds 5 MB limit (${content.length} bytes). Stream large files instead.`,
    );
  }
  const msg: FileMessage = { type: 'file', name, content, mimeType };
  session.recordA2UIEmission(msg);
}
