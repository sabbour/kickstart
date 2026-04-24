/**
 * Tests for crypto failure handling in generateAnonSessionToken (#1079 / #1143).
 *
 * These tests live in a separate file because they stub globalThis.crypto
 * and we need different stub configurations per scenario.
 *
 * The implementation uses the Web Crypto API (crypto.getRandomValues +
 * crypto.subtle.digest), so we stub those rather than node:crypto.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Session,
  generateAnonSessionToken,
  AnonTokenGenerationError,
} from '../runtime/session.js';

const realGetRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
const realDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateAnonSessionToken — crypto failure', () => {
  it('throws AnonTokenGenerationError when getRandomValues fails', async () => {
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('Entropy source exhausted');
    });

    const session = new Session({ sessionId: 'fail-rb', user: { oid: 'anonymous' } });
    await expect(generateAnonSessionToken(session)).rejects.toThrowError('ANON_TOKEN_GENERATION_FAILED');

    let caught: unknown;
    try { await generateAnonSessionToken(session); } catch (err) { caught = err; }

    expect(caught).toBeInstanceOf(AnonTokenGenerationError);
    expect((caught as AnonTokenGenerationError).cause).toBeInstanceOf(Error);
    expect(((caught as AnonTokenGenerationError).cause as Error).message).toBe('Entropy source exhausted');

    // Session hash must not be mutated on failure
    expect(session.anonTokenHash).toBeUndefined();
  });

  it('throws AnonTokenGenerationError when subtle.digest fails', async () => {
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(() => {
      throw new Error('Algorithm not available');
    });

    const session = new Session({ sessionId: 'fail-ch', user: { oid: 'anonymous' } });
    await expect(generateAnonSessionToken(session)).rejects.toThrowError('ANON_TOKEN_GENERATION_FAILED');

    let caught: unknown;
    try { await generateAnonSessionToken(session); } catch (err) { caught = err; }

    expect(caught).toBeInstanceOf(AnonTokenGenerationError);
    expect(((caught as AnonTokenGenerationError).cause as Error).message).toBe('Algorithm not available');
  });

  it('still works normally when crypto is healthy', async () => {
    const session = new Session({ sessionId: 'ok-1', user: { oid: 'anonymous' } });
    const token = await generateAnonSessionToken(session);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(session.anonTokenHash).toBeDefined();
  });
});
