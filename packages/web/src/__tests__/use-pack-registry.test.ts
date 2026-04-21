/**
 * Unit tests for usePackRegistry / fetchRegistry.
 *
 * Tests the module-level memoized fetcher directly (same pattern as
 * streaming-406-fallback.test.ts which exports _performSdkNonStreamingFetch).
 *
 * fetch is stubbed via vi.stubGlobal — apiFetch wraps fetch so no additional
 * mocking layer is needed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _fetchRegistry, _resetRegistryCache } from '../hooks/usePackRegistry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchOk(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  );
}

function mockFetchStatus(status: number): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response('{}', { status }),
      ),
    ),
  );
}

function mockFetchNetworkError(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.reject(new Error('Network failure')),
    ),
  );
}

// ---------------------------------------------------------------------------
// Reset module-level cache between each test
// ---------------------------------------------------------------------------

beforeEach(() => _resetRegistryCache());
afterEach(() => {
  vi.unstubAllGlobals();
  _resetRegistryCache();
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('_fetchRegistry — happy path', () => {
  it('returns adapted PlaygroundRegistryView from server DTO', async () => {
    mockFetchOk({
      components: [
        { name: 'core/Button', propertySchema: { type: 'object' } },
        { name: 'core/Text', propertySchema: { type: 'object' } },
      ],
      userActions: [],
      playgroundScenarios: [
        { id: 'scenario-1', title: 'Demo scenario', description: 'Desc', group: 'Demos' },
      ],
    });

    const registry = await _fetchRegistry();

    expect(registry.components).toHaveLength(2);
    expect(registry.components[0].name).toBe('core/Button');
    expect(registry.components[1].name).toBe('core/Text');

    expect(registry.playgroundScenarios).toHaveLength(1);
    const scenario = registry.playgroundScenarios[0];
    expect(scenario.id).toBe('scenario-1');
    expect(scenario.title).toBe('Demo scenario');
    expect(scenario.description).toBe('Desc');
    expect(scenario.group).toBe('Demos');
    // a2ui must default to empty array (server doesn't send it)
    expect(scenario.a2ui).toEqual([]);

    // playgroundStubs always empty (not sent by server)
    expect(registry.playgroundStubs).toEqual({});
  });

  it('memoises: second call returns same Promise without re-fetching', async () => {
    mockFetchOk({ components: [], userActions: [], playgroundScenarios: [] });

    const p1 = _fetchRegistry();
    const p2 = _fetchRegistry();
    expect(p1).toBe(p2);

    await p1;
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Error paths
// ---------------------------------------------------------------------------

describe('_fetchRegistry — error paths', () => {
  it('throws and clears cache on non-OK HTTP status (500)', async () => {
    mockFetchStatus(500);

    await expect(_fetchRegistry()).rejects.toThrow('/api/packs returned 500');

    // Cache must be cleared so next call retries
    mockFetchOk({ components: [], userActions: [], playgroundScenarios: [] });
    const registry = await _fetchRegistry();
    expect(registry.components).toEqual([]);
  });

  it('throws and clears cache on network error', async () => {
    mockFetchNetworkError();

    await expect(_fetchRegistry()).rejects.toThrow('Network failure');

    // Cache must be cleared so next call retries
    mockFetchOk({ components: [], userActions: [], playgroundScenarios: [] });
    const registry = await _fetchRegistry();
    expect(registry.playgroundScenarios).toEqual([]);
  });
});
