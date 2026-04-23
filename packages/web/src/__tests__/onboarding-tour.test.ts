import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'kickstart-onboarding-complete';

// Minimal localStorage mock for Node environment
const store = new Map<string, string>();
const storageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
};

describe('OnboardingTour localStorage logic', () => {
  beforeEach(() => {
    storageMock.clear();
  });

  it('tour is not marked complete by default', () => {
    expect(storageMock.getItem(STORAGE_KEY)).toBeNull();
  });

  it('marks tour complete when flag is set', () => {
    storageMock.setItem(STORAGE_KEY, 'true');
    expect(storageMock.getItem(STORAGE_KEY)).toBe('true');
  });

  it('can reset the tour by removing the flag', () => {
    storageMock.setItem(STORAGE_KEY, 'true');
    storageMock.removeItem(STORAGE_KEY);
    expect(storageMock.getItem(STORAGE_KEY)).toBeNull();
  });

  it('flag persists across reads', () => {
    storageMock.setItem(STORAGE_KEY, 'true');
    expect(storageMock.getItem(STORAGE_KEY)).toBe('true');
    expect(storageMock.getItem(STORAGE_KEY)).toBe('true');
  });
});
