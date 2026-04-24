/**
 * Unit tests for anonymous session token security (#1079).
 *
 * Covers:
 *  - Token generation produces unique, non-empty tokens
 *  - Token hash is stored on the session after generation
 *  - Valid token passes validation
 *  - Wrong token fails validation (timing-safe)
 *  - Missing token fails validation
 *  - Empty string token fails validation
 *  - Token validation with no hash stored fails
 *  - Authenticated sessions don't get tokens (isAnonymousSession)
 *  - getOrCreateSessionResult reports created=true for new sessions
 *  - getOrCreateSessionResult reports created=false for resumed sessions
 *  - getOrCreateSessionResult throws SESSION_OID_MISMATCH on cross-user
 *  - Anonymous sessions use shorter TTL in cleanup
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  Session,
  sessionStore,
  getOrCreateSessionResult,
  generateAnonSessionToken,
  validateAnonSessionToken,
  isAnonymousSession,
  ANON_SESSION_TTL_MS,
} from '../runtime/session.js';

afterEach(() => {
  sessionStore.clear();
});

describe('generateAnonSessionToken', () => {
  it('returns a non-empty base64url string', async () => {
    const session = new Session({ sessionId: 's1', user: { oid: 'anonymous' } });
    const token = await generateAnonSessionToken(session);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    // base64url characters only
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('stores a hash on the session after generation', async () => {
    const session = new Session({ sessionId: 's1', user: { oid: 'anonymous' } });
    expect(session.anonTokenHash).toBeUndefined();
    await generateAnonSessionToken(session);
    expect(session.anonTokenHash).toBeDefined();
    expect(typeof session.anonTokenHash).toBe('string');
    expect(session.anonTokenHash!.length).toBeGreaterThan(0);
  });

  it('generates unique tokens across calls', async () => {
    const s1 = new Session({ sessionId: 's1', user: { oid: 'anonymous' } });
    const s2 = new Session({ sessionId: 's2', user: { oid: 'anonymous' } });
    const t1 = await generateAnonSessionToken(s1);
    const t2 = await generateAnonSessionToken(s2);
    expect(t1).not.toBe(t2);
  });

  it('stored hash differs from raw token (one-way)', async () => {
    const session = new Session({ sessionId: 's1', user: { oid: 'anonymous' } });
    const token = await generateAnonSessionToken(session);
    expect(session.anonTokenHash).not.toBe(token);
  });
});

describe('validateAnonSessionToken', () => {
  it('returns true for a matching token', async () => {
    const session = new Session({ sessionId: 's1', user: { oid: 'anonymous' } });
    const token = await generateAnonSessionToken(session);
    expect(await validateAnonSessionToken(session, token)).toBe(true);
  });

  it('returns false for a wrong token', async () => {
    const session = new Session({ sessionId: 's1', user: { oid: 'anonymous' } });
    await generateAnonSessionToken(session);
    expect(await validateAnonSessionToken(session, 'wrong-token-value')).toBe(false);
  });

  it('returns false when no hash is stored', async () => {
    const session = new Session({ sessionId: 's1', user: { oid: 'anonymous' } });
    expect(await validateAnonSessionToken(session, 'any-token')).toBe(false);
  });

  it('returns false for empty string', async () => {
    const session = new Session({ sessionId: 's1', user: { oid: 'anonymous' } });
    await generateAnonSessionToken(session);
    expect(await validateAnonSessionToken(session, '')).toBe(false);
  });

  it('returns false for non-string input', async () => {
    const session = new Session({ sessionId: 's1', user: { oid: 'anonymous' } });
    await generateAnonSessionToken(session);
    // @ts-expect-error intentional bad input
    expect(await validateAnonSessionToken(session, undefined)).toBe(false);
    // @ts-expect-error intentional bad input
    expect(await validateAnonSessionToken(session, null)).toBe(false);
    // @ts-expect-error intentional bad input
    expect(await validateAnonSessionToken(session, 123)).toBe(false);
  });

  it('re-generating a token invalidates the previous one', async () => {
    const session = new Session({ sessionId: 's1', user: { oid: 'anonymous' } });
    const token1 = await generateAnonSessionToken(session);
    const token2 = await generateAnonSessionToken(session);
    expect(await validateAnonSessionToken(session, token1)).toBe(false);
    expect(await validateAnonSessionToken(session, token2)).toBe(true);
  });
});

describe('isAnonymousSession', () => {
  it('returns true for oid="anonymous"', () => {
    const session = new Session({ sessionId: 's1', user: { oid: 'anonymous' } });
    expect(isAnonymousSession(session)).toBe(true);
  });

  it('returns false for authenticated user', () => {
    const session = new Session({ sessionId: 's1', user: { oid: 'user-abc-123' } });
    expect(isAnonymousSession(session)).toBe(false);
  });
});

describe('getOrCreateSessionResult', () => {
  it('reports created=true for a brand-new session', () => {
    const result = getOrCreateSessionResult(undefined, 'anonymous');
    expect(result.created).toBe(true);
    expect(result.session).toBeDefined();
    expect(result.session.user.oid).toBe('anonymous');
  });

  it('reports created=false when resuming an existing session', () => {
    const first = getOrCreateSessionResult(undefined, 'anonymous');
    const second = getOrCreateSessionResult(first.session.sessionId, 'anonymous');
    expect(second.created).toBe(false);
    expect(second.session.sessionId).toBe(first.session.sessionId);
  });

  it('throws SESSION_OID_MISMATCH on cross-user resume', () => {
    const first = getOrCreateSessionResult(undefined, 'user-a');
    expect(() => getOrCreateSessionResult(first.session.sessionId, 'user-b')).toThrow(
      'SESSION_OID_MISMATCH',
    );
  });

  it('creates a new session with a client-supplied ID if not found', () => {
    const result = getOrCreateSessionResult('custom-id-123', 'anonymous');
    expect(result.created).toBe(true);
    expect(result.session.sessionId).toBe('custom-id-123');
  });
});

describe('ANON_SESSION_TTL_MS', () => {
  it('is shorter than the default 30-minute session TTL', () => {
    const DEFAULT_TTL = 30 * 60 * 1000;
    expect(ANON_SESSION_TTL_MS).toBeLessThan(DEFAULT_TTL);
    expect(ANON_SESSION_TTL_MS).toBe(10 * 60 * 1000);
  });
});

describe('anonymous session token — integration scenario', () => {
  it('full flow: create session → generate token → validate on resume', async () => {
    // 1. Create anonymous session
    const { session } = getOrCreateSessionResult(undefined, 'anonymous');
    expect(isAnonymousSession(session)).toBe(true);

    // 2. Generate token
    const token = await generateAnonSessionToken(session);
    expect(token).toBeTruthy();

    // 3. Resume with valid token
    const { session: resumed } = getOrCreateSessionResult(session.sessionId, 'anonymous');
    expect(await validateAnonSessionToken(resumed, token)).toBe(true);

    // 4. Attacker tries with wrong token
    expect(await validateAnonSessionToken(resumed, 'attacker-guessed-token')).toBe(false);
  });

  it('attacker cannot resume another anonymous session without the token', async () => {
    // Victim creates session
    const { session: victimSession } = getOrCreateSessionResult(undefined, 'anonymous');
    const victimToken = await generateAnonSessionToken(victimSession);

    // Attacker guesses the sessionId but doesn't have the token
    const { session: attackerResumed } = getOrCreateSessionResult(
      victimSession.sessionId,
      'anonymous',
    );
    // Without the real token, validation fails
    expect(await validateAnonSessionToken(attackerResumed, '')).toBe(false);
    expect(await validateAnonSessionToken(attackerResumed, 'guess')).toBe(false);

    // With the real token, validation succeeds (proves the mechanism works)
    expect(await validateAnonSessionToken(attackerResumed, victimToken)).toBe(true);
  });
});
