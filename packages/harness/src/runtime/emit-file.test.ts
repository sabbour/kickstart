import { describe, it, expect, beforeEach } from 'vitest';
import { emitFile } from './emit-file.js';
import { Session } from './session.js';
import type { FileMessage } from '../types/a2ui.js';
import { FileMessageSchema, A2UIMessageSchema } from '../types/a2ui.js';

function makeSession(): Session {
  return new Session({ sessionId: 'test-session', user: { oid: 'user-1' } });
}

/** Extract all file-type A2UI emissions from a drained batch. */
function drainFiles(session: Session): FileMessage[] {
  return session.drainA2UIEmissions().filter(
    (m): m is FileMessage => (m as FileMessage).type === 'file',
  );
}

describe('emitFile()', () => {
  let session: Session;

  beforeEach(() => {
    session = makeSession();
  });

  it('emits a file event with the correct name and content', () => {
    emitFile(session, 'src/main.ts', 'export const x = 1;');
    const files = drainFiles(session);
    expect(files).toHaveLength(1);
    expect(files[0].type).toBe('file');
    expect(files[0].name).toBe('src/main.ts');
    expect(files[0].content).toBe('export const x = 1;');
  });

  it('mimeType is optional and defaults to undefined when omitted', () => {
    emitFile(session, 'README.md', '# hello');
    const [file] = drainFiles(session);
    expect(file.mimeType).toBeUndefined();
  });

  it('includes mimeType when provided', () => {
    emitFile(session, 'index.html', '<html/>', 'text/html');
    const [file] = drainFiles(session);
    expect(file.mimeType).toBe('text/html');
  });

  it('emits multiple files independently', () => {
    emitFile(session, 'a.ts', 'const a = 1;');
    emitFile(session, 'b.ts', 'const b = 2;');
    emitFile(session, 'c.ts', 'const c = 3;', 'text/typescript');
    const files = drainFiles(session);
    expect(files).toHaveLength(3);
    expect(files.map((f) => f.name)).toEqual(['a.ts', 'b.ts', 'c.ts']);
    expect(files[2].mimeType).toBe('text/typescript');
  });

  it('drain is destructive — a second drain returns no file events', () => {
    emitFile(session, 'once.ts', 'content');
    // first drain
    const first = drainFiles(session);
    expect(first).toHaveLength(1);
    // second drain should be empty
    const second = drainFiles(session);
    expect(second).toHaveLength(0);
  });

  it('file events coexist with other A2UI emissions in the queue', () => {
    // simulate a prior a2ui emission already in the queue
    session.recordA2UIEmission({
      version: 'v0.9',
      createSurface: { surfaceId: 'surf-1', catalogId: 'kickstart' },
    } as Parameters<typeof session.recordA2UIEmission>[0]);
    emitFile(session, 'output.txt', 'hello');

    const all = session.drainA2UIEmissions();
    expect(all).toHaveLength(2);
    const fileEvents = all.filter((m): m is FileMessage => (m as FileMessage).type === 'file');
    expect(fileEvents).toHaveLength(1);
    expect(fileEvents[0].name).toBe('output.txt');
  });
});

describe('emitFile() — size guard', () => {
  it('throws when content exceeds 5 MB', () => {
    const bigContent = 'x'.repeat(5_000_001);
    const fakeSession = { recordA2UIEmission: () => {} };
    expect(() => emitFile(fakeSession, 'big.txt', bigContent)).toThrow(
      'emitFile: content exceeds 5 MB limit',
    );
    expect(() => emitFile(fakeSession, 'big.txt', bigContent)).toThrow(
      `${bigContent.length} bytes`,
    );
  });

  it('does not throw when content is exactly 5 MB', () => {
    const exactContent = 'x'.repeat(5_000_000);
    const fakeSession = { recordA2UIEmission: () => {} };
    expect(() => emitFile(fakeSession, 'exact.txt', exactContent)).not.toThrow();
  });
});

describe('FileMessageSchema and A2UIMessageSchema', () => {
  it('FileMessageSchema accepts a valid file message', () => {
    const result = FileMessageSchema.safeParse({
      type: 'file',
      name: 'src/main.ts',
      content: 'export const x = 1;',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('file');
      expect(result.data.name).toBe('src/main.ts');
      expect(result.data.mimeType).toBeUndefined();
    }
  });

  it('FileMessageSchema accepts optional mimeType', () => {
    const result = FileMessageSchema.safeParse({
      type: 'file',
      name: 'index.html',
      content: '<html/>',
      mimeType: 'text/html',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mimeType).toBe('text/html');
    }
  });

  it('FileMessageSchema rejects messages with wrong type discriminant', () => {
    const result = FileMessageSchema.safeParse({
      type: 'other',
      name: 'foo.ts',
      content: 'bar',
    });
    expect(result.success).toBe(false);
  });

  it('A2UIMessageSchema accepts a FileMessage (type: file)', () => {
    const result = A2UIMessageSchema.safeParse({
      type: 'file',
      name: 'output.ts',
      content: 'const x = 1;',
    });
    expect(result.success).toBe(true);
  });

  it('A2UIMessageSchema accepts a createSurface envelope message', () => {
    const result = A2UIMessageSchema.safeParse({
      version: 'v0.9',
      createSurface: { surfaceId: 'surf-1', catalogId: 'kickstart' },
    });
    expect(result.success).toBe(true);
  });

  it('A2UIMessageSchema rejects unknown message shapes', () => {
    const result = A2UIMessageSchema.safeParse({ foo: 'bar' });
    expect(result.success).toBe(false);
  });
});
