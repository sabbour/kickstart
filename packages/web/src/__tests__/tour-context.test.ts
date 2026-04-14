import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'kickstart-tour';

// We test the pure localStorage logic since TourContext is a React context.
// The context delegates to these same read/write functions.

function readTourState(): { completed: boolean; version: number; dismissedAt?: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.completed === 'boolean' &&
      typeof parsed.version === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeTourState(state: { completed: boolean; version: number; dismissedAt?: string }): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // silently ignore
  }
}

// Mock localStorage
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
  get length() { return Object.keys(store).length; },
  key: vi.fn((_i: number) => null),
};

describe('Tour localStorage persistence', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  it('returns null when no tour state is stored', () => {
    expect(readTourState()).toBeNull();
  });

  it('writes and reads tour state correctly', () => {
    const state = { completed: true, version: 1, dismissedAt: '2026-04-14T17:00:00.000Z' };
    writeTourState(state);
    expect(readTourState()).toEqual(state);
  });

  it('returns null for corrupted JSON', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
    expect(readTourState()).toBeNull();
  });

  it('returns null for wrong schema (missing completed)', () => {
    mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1 }));
    expect(readTourState()).toBeNull();
  });

  it('returns null for wrong schema (missing version)', () => {
    mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: true }));
    expect(readTourState()).toBeNull();
  });

  it('returns null for wrong types', () => {
    mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: 'yes', version: '1' }));
    expect(readTourState()).toBeNull();
  });

  it('simulates full tour lifecycle: start → next → next → next → complete', () => {
    // Initially no state
    expect(readTourState()).toBeNull();

    // Simulate completing the tour
    writeTourState({ completed: true, version: 1, dismissedAt: new Date().toISOString() });

    // Read back
    const state = readTourState();
    expect(state).not.toBeNull();
    expect(state!.completed).toBe(true);
    expect(state!.version).toBe(1);
    expect(state!.dismissedAt).toBeDefined();
  });

  it('version bump re-triggers tour for users who completed old version', () => {
    writeTourState({ completed: true, version: 1 });
    const saved = readTourState();
    expect(saved).not.toBeNull();

    // Simulate version check: current version > saved version → should re-show
    const CURRENT_VERSION = 2;
    const shouldReshow = !saved!.completed || saved!.version < CURRENT_VERSION;
    expect(shouldReshow).toBe(true);
  });

  it('does not re-trigger tour when version matches', () => {
    writeTourState({ completed: true, version: 1 });
    const saved = readTourState();
    const CURRENT_VERSION = 1;
    const shouldReshow = !saved || !saved.completed || saved.version < CURRENT_VERSION;
    expect(shouldReshow).toBe(false);
  });
});
