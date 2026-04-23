/**
 * SSE (Server-Sent Events) utilities for the v2 harness runtime.
 *
 * 9 event types used across converse and resume handlers:
 *   start           – turn began (no data)
 *   chunk           – text delta from the model
 *   a2ui            – A2UI protocol message emitted by a skill/tool
 *   tool_start      – a tool call has started
 *   tool_done       – a tool call completed (success or error)
 *   phase           – agent phase transition (e.g. "discover" → "assess")
 *   user_action_req – agent needs a browser-side UserAction result to continue
 *   end             – turn completed (may carry session metadata)
 *   error           – unrecoverable error in the stream
 */

export type SSEEventType =
  | 'start'
  | 'chunk'
  | 'a2ui'
  | 'tool_start'
  | 'tool_done'
  | 'phase'
  | 'user_action_req'
  | 'end'
  | 'error';

export const SSE_EVENT_TYPES = new Set<SSEEventType>([
  'start', 'chunk', 'a2ui', 'tool_start', 'tool_done',
  'phase', 'user_action_req', 'end', 'error',
]);

/** Opaque writer type passed to Runner and resume handler. */
export type SSEWriter = (event: SSEEventType, data: unknown) => void;

/**
 * Format a single SSE frame.
 * The `event:` field is always included so the browser can discriminate events.
 */
export function formatSSEFrame(event: SSEEventType, data: unknown): string {
  const json = JSON.stringify(data);
  return `event: ${event}\ndata: ${json}\n\n`;
}

/**
 * Write a single SSE event to a Node.js-style stream that exposes a
 * `write(chunk: string) => void` interface (e.g. `http.ServerResponse`).
 */
export function writeSSE(
  stream: { write: (chunk: string) => void },
  event: SSEEventType,
  data: unknown,
): void {
  stream.write(formatSSEFrame(event, data));
}

/** Headers required on the HTTP response to enable SSE. */
export const SSE_RESPONSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',   // disable nginx buffering
  Connection: 'keep-alive',
} as const;

/**
 * Create an in-process SSE stream backed by a TransformStream-compatible pair.
 * Useful for testing or environments where we produce a ReadableStream from scratch.
 */
export function createSSEStream(): {
  readable: ReadableStream<Uint8Array>;
  write: (event: SSEEventType, data: unknown) => void;
  close: () => void;
} {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;

  const readable = new ReadableStream<Uint8Array>({
    start(c) { controller = c; },
  });

  return {
    readable,
    write(event, data) {
      controller.enqueue(encoder.encode(formatSSEFrame(event, data)));
    },
    close() {
      try { controller.close(); } catch { /* already closed */ }
    },
  };
}
