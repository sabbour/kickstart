/**
 * Tests for crypto failure handling in generateAnonSessionToken (#1079 / #1143).
 *
 * These tests live in a separate file because vi.mock() must be hoisted
 * and we need different mock configurations per scenario.
 */

import { describe, expect, it, vi } from 'vitest';

let shouldRandomBytesFail = false;
let shouldCreateHashFail = false;

vi.mock('node:crypto', async () => {
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto');
  return {
    ...actual,
    randomBytes: (...args: Parameters<typeof actual.randomBytes>) => {
      if (shouldRandomBytesFail) throw new Error('Entropy source exhausted');
      return actual.randomBytes(...args);
    },
    createHash: (...args: Parameters<typeof actual.createHash>) => {
      if (shouldCreateHashFail) throw new Error('Algorithm not available');
      return actual.createHash(...args);
    },
  };
});

import {
  Session,
  generateAnonSessionToken,
  AnonTokenGenerationError,
} from '../runtime/session.js';

describe('generateAnonSessionToken — crypto failure', () => {
  it('throws AnonTokenGenerationError when randomBytes fails', () => {
    shouldRandomBytesFail = true;
    try {
      const session = new Session({ sessionId: 'fail-rb', user: { oid: 'anonymous' } });
      expect(() => generateAnonSessionToken(session)).toThrowError('ANON_TOKEN_GENERATION_FAILED');

      let caught: unknown;
      try { generateAnonSessionToken(session); } catch (err) { caught = err; }

      expect(caught).toBeInstanceOf(AnonTokenGenerationError);
      expect((caught as AnonTokenGenerationError).cause).toBeInstanceOf(Error);
      expect(((caught as AnonTokenGenerationError).cause as Error).message).toBe('Entropy source exhausted');

      // Session hash must not be mutated on failure
      expect(session.anonTokenHash).toBeUndefined();
    } finally {
      shouldRandomBytesFail = false;
    }
  });

  it('throws AnonTokenGenerationError when createHash fails', () => {
    shouldCreateHashFail = true;
    try {
      const session = new Session({ sessionId: 'fail-ch', user: { oid: 'anonymous' } });
      expect(() => generateAnonSessionToken(session)).toThrowError('ANON_TOKEN_GENERATION_FAILED');

      let caught: unknown;
      try { generateAnonSessionToken(session); } catch (err) { caught = err; }

      expect(caught).toBeInstanceOf(AnonTokenGenerationError);
      expect(((caught as AnonTokenGenerationError).cause as Error).message).toBe('Algorithm not available');
    } finally {
      shouldCreateHashFail = false;
    }
  });

  it('still works normally when crypto is healthy', () => {
    const session = new Session({ sessionId: 'ok-1', user: { oid: 'anonymous' } });
    const token = generateAnonSessionToken(session);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(session.anonTokenHash).toBeDefined();
  });
});
