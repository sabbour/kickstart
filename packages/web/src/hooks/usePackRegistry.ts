/**
 * usePackRegistry — fetches /api/packs once per module lifetime and returns
 * a PlaygroundRegistryView-compatible object.
 *
 * Module-level Promise cache: the endpoint sends Cache-Control: public, max-age=60
 * so we memoize the Promise to avoid redundant fetches across re-mounts.
 * On error the cache is cleared so the next mount retries.
 */

import { useState, useEffect } from 'react';
import type { PlaygroundRegistryView } from './usePlaygroundDispatch';
import type { PlaygroundScenario, ComponentContribution } from '@aks-kickstart/harness';
import { apiFetch } from '../services/api-client';

// ── Wire-format DTOs (subset of server response) ─────────────────────────────

interface ComponentDTO {
  name: string;
  propertySchema: unknown;
}

interface PlaygroundScenarioDTO {
  id: string;
  title: string;
  description?: string;
  group?: string;
}

interface PackLoadErrorDTO {
  packId: string;
  reason: string;
}

interface PacksDTO {
  components: ComponentDTO[];
  playgroundScenarios: PlaygroundScenarioDTO[];
  loadErrors?: PackLoadErrorDTO[];
}

// ── DTO adapters ──────────────────────────────────────────────────────────────

function adaptScenario(dto: PlaygroundScenarioDTO): PlaygroundScenario {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    group: dto.group,
    // a2ui preview data is not sent over the wire (server guards it).
    // Gallery cards render the title/description; previews remain blank.
    a2ui: [],
  };
}

function adaptComponent(dto: ComponentDTO): ComponentContribution {
  return {
    name: dto.name,
    // Server sends JSON Schema; Playground.tsx only reads comp.name.
    // Cast to satisfy the structural type without widening the interface.
    propertySchema: dto.propertySchema as unknown as ComponentContribution['propertySchema'],
    renderer: undefined as unknown as ComponentContribution['renderer'],
  };
}

function adaptDTO(data: PacksDTO): PlaygroundRegistryView {
  return {
    playgroundScenarios: (data.playgroundScenarios ?? []).map(adaptScenario),
    components: (data.components ?? []).map(adaptComponent),
    // playgroundStubs are not provided by the server (out of scope per issue #934).
    playgroundStubs: {},
  };
}

// ── Module-level Promise cache ────────────────────────────────────────────────

let _cachedPromise: Promise<PlaygroundRegistryView> | null = null;

function fetchRegistry(): Promise<PlaygroundRegistryView> {
  if (_cachedPromise) return _cachedPromise;
  _cachedPromise = apiFetch('/api/packs')
    .then(res => {
      if (!res.ok) throw new Error(`/api/packs returned ${res.status}`);
      return res.json() as Promise<PacksDTO>;
    })
    .then(adaptDTO)
    .catch((err: unknown) => {
      // Clear cache on error so the next mount gets a fresh attempt.
      _cachedPromise = null;
      throw err;
    });
  return _cachedPromise;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const EMPTY_REGISTRY: PlaygroundRegistryView = {
  playgroundScenarios: [],
  components: [],
  playgroundStubs: {},
};

export interface UsePackRegistryResult {
  registry: PlaygroundRegistryView;
  loading: boolean;
  error: string | null;
}

export function usePackRegistry(): UsePackRegistryResult {
  const [registry, setRegistry] = useState<PlaygroundRegistryView>(EMPTY_REGISTRY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRegistry()
      .then(r => {
        if (!cancelled) {
          setRegistry(r);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return { registry, loading, error };
}

// Exported for testing only — allows resetting module-level state between tests.
export function _resetRegistryCache(): void {
  _cachedPromise = null;
}

// Exported for testing only — the raw Promise-based fetcher.
export { fetchRegistry as _fetchRegistry };
