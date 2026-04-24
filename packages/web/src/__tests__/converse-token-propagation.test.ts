/**
 * Contract tests for frontend x-anon-session-token propagation (#23)
 *
 * Verifies that:
 * 1. session_token SSE event stores token in sessionStorage
 * 2. Subsequent apiFetch calls include the stored token as a header
 * 3. No token header is sent for new sessions (no prior token)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  storeAnonSessionToken,
  getAnonSessionToken,
  clearAnonSessionToken,
  apiFetch,
} from '../services/api-client';

// Mock sessionStorage
const store = new Map<string, string>();
const sessionStorageMock = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => store.set(key, value)),
  removeItem: vi.fn((key: string) => store.delete(key)),
  clear: vi.fn(() => store.clear()),
  get length() { return store.size; },
  key: vi.fn(() => null),
};
vi.stubGlobal('sessionStorage', sessionStorageMock);

// Mock fetch
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('Anonymous session token propagation (#23)', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      type: 'default',
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    });
  });

  describe('storeAnonSessionToken / getAnonSessionToken', () => {
    it('stores and retrieves token keyed by session ID', () => {
      storeAnonSessionToken('sess-abc', 'tok-123');
      expect(getAnonSessionToken('sess-abc')).toBe('tok-123');
    });

    it('returns null for unknown session', () => {
      expect(getAnonSessionToken('no-such-session')).toBeNull();
    });

    it('clearAnonSessionToken removes stored token', () => {
      storeAnonSessionToken('sess-abc', 'tok-123');
      clearAnonSessionToken('sess-abc');
      expect(getAnonSessionToken('sess-abc')).toBeNull();
    });

    it('does not cross-contaminate between sessions', () => {
      storeAnonSessionToken('sess-1', 'tok-A');
      storeAnonSessionToken('sess-2', 'tok-B');
      expect(getAnonSessionToken('sess-1')).toBe('tok-A');
      expect(getAnonSessionToken('sess-2')).toBe('tok-B');
    });
  });

  describe('apiFetch token injection', () => {
    it('sends x-anon-session-token header when token exists for session', async () => {
      storeAnonSessionToken('sess-abc', 'tok-123');

      await apiFetch('/api/converse', { method: 'POST' }, false, 'sess-abc');

      const [, init] = fetchMock.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get('x-anon-session-token')).toBe('tok-123');
    });

    it('does NOT send x-anon-session-token when no token stored', async () => {
      await apiFetch('/api/converse', { method: 'POST' }, false, 'sess-new');

      const [, init] = fetchMock.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get('x-anon-session-token')).toBeNull();
    });

    it('does NOT send x-anon-session-token when no sessionId provided', async () => {
      storeAnonSessionToken('sess-abc', 'tok-123');

      await apiFetch('/api/converse', { method: 'POST' });

      const [, init] = fetchMock.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get('x-anon-session-token')).toBeNull();
    });
  });
});
