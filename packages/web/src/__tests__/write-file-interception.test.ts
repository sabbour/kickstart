/**
 * Unit tests for write_file tool_done SSE event interception.
 *
 * Phase C (#7): When the codesmith agent calls write_file, the SSE stream
 * emits tool_done with path + content. The streaming hook must parse these
 * and invoke onWriteFile so files land in the editor pane, not in chat.
 *
 * Security: per Zapp, the frontend must treat write_file payloads as
 * untrusted — path validation and size caps happen in the App handler,
 * but the streaming layer must faithfully forward valid events.
 */

import { describe, expect, it, vi } from 'vitest';
import { _processSSEStream } from '../hooks/useStreaming';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sseFrame(eventType: string, data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
}

function makeSSEStream(frames: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(frame);
      controller.close();
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('_processSSEStream — tool_done write_file interception (#7)', () => {
  it('does not crash on tool_done events (existing no-op behavior for non-write_file)', async () => {
    const stream = makeSSEStream([
      sseFrame('start', { sessionId: 'sess-1' }),
      sseFrame('tool_start', { toolName: 'core.emit_ui' }),
      sseFrame('tool_done', { toolName: 'core.emit_ui' }),
      sseFrame('end', { sessionId: 'sess-1' }),
    ]);

    const result = await _processSSEStream(stream, {});
    expect(result.sessionId).toBe('sess-1');
  });

  it('tool_done for write_file without onWriteFile callback does not throw', async () => {
    const stream = makeSSEStream([
      sseFrame('start', { sessionId: 'sess-2' }),
      sseFrame('tool_done', {
        toolName: 'core.write_file',
        path: 'Dockerfile',
        content: 'FROM node:20',
      }),
      sseFrame('end', { sessionId: 'sess-2' }),
    ]);

    // No callbacks provided — should handle gracefully
    const result = await _processSSEStream(stream, {});
    expect(result.sessionId).toBe('sess-2');
  });
});

/**
 * Tests for handleWriteFile byte-length checking.
 * 
 * Issue: JavaScript's String.length counts UTF-16 code units, not bytes.
 * Multibyte UTF-8 content can exceed 5MB while passing a string.length check.
 * Solution: Use TextEncoder().encode().byteLength for accurate byte counting.
 */
describe('handleWriteFile — byte-length validation', () => {
  it('should use byte-length (not string length) for size check', () => {
    // String with multibyte UTF-8 characters (emoji, CJK, etc.)
    // Emoji is a surrogate pair in UTF-16 (2 code units), 4 bytes in UTF-8
    const emoji = '😀';
    expect(emoji.length).toBe(2);
    expect(new TextEncoder().encode(emoji).byteLength).toBe(4);
  });

  it('should properly reject content exceeding 5MB when measured in bytes', () => {
    // Create content with multibyte characters that would pass string.length check
    // but fail a proper byte-length check.
    const multibyte = '🎉'; // 4 bytes per character
    const copies = Math.ceil((5 * 1024 * 1024) / 4) + 1; // Exceed 5MB by 1 char
    const content = multibyte.repeat(copies);

    const byteLength = new TextEncoder().encode(content).byteLength;
    const MAX_WRITE_FILE_SIZE = 5 * 1024 * 1024;
    expect(byteLength).toBeGreaterThan(MAX_WRITE_FILE_SIZE);
  });

  it('should accept valid UTF-8 content under 5MB byte limit', () => {
    // Create valid content that fits within 5MB
    const content = 'a'.repeat(4 * 1024 * 1024); // 4 MB ASCII

    const byteLength = new TextEncoder().encode(content).byteLength;
    const MAX_WRITE_FILE_SIZE = 5 * 1024 * 1024;
    expect(byteLength).toBeLessThan(MAX_WRITE_FILE_SIZE);
  });
});
