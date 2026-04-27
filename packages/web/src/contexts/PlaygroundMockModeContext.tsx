import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'kickstart:playground:mock-mode';
const mockModeEvents = new EventTarget();

function readStoredMockMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (!new URLSearchParams(window.location.search).has('playground')) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function isPlaygroundMockModeEnabled(): boolean {
  return readStoredMockMode();
}

export function setPlaygroundMockModeEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // Ignore storage failures; subscribers still receive the in-memory event.
    }
  }
  mockModeEvents.dispatchEvent(new Event('change'));
}

export function subscribePlaygroundMockMode(listener: () => void): () => void {
  mockModeEvents.addEventListener('change', listener);
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', listener);
  }
  return () => {
    mockModeEvents.removeEventListener('change', listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', listener);
    }
  };
}

export function usePlaygroundMockMode(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(
    subscribePlaygroundMockMode,
    isPlaygroundMockModeEnabled,
    () => false,
  );

  return [enabled, setPlaygroundMockModeEnabled];
}
