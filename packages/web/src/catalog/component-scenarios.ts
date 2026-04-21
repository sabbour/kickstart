/**
 * Aggregated scenario fixtures consumed by the Playground Ideas tab (#987).
 *
 * Layout mirrors `./component-previews.ts`:
 *  - `core/*` scenarios live co-located with the web catalog in `./core-scenarios`.
 *  - `azure/*`, `aks/*`, `github/*` scenarios are **pack-contributed** via each
 *    pack's `./client` subpath export, so pack authors own their curation bar
 *    and new packs can contribute ideas without core changes.
 *
 * Each aggregated entry exposes the original `PackScenario`/`Scenario`
 * descriptors plus a `pack`-qualified scenario ID suitable for use as a React
 * key or URL fragment.
 */

import { scenarios as azureScenarios } from '@aks-kickstart/pack-azure/client';
import { scenarios as aksScenarios } from '@aks-kickstart/pack-aks-automatic/client';
import { scenarios as githubScenarios } from '@aks-kickstart/pack-github/client';
import { CORE_SCENARIOS, type Scenario } from './core-scenarios';

export type PackName = 'core' | 'azure' | 'aks' | 'github';

export interface AggregatedScenario {
  readonly pack: PackName;
  readonly scenarioId: string;
  /** `${pack}/${scenarioId}` — stable key for React/URL use. */
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly components: ReadonlyArray<Readonly<Record<string, unknown>>>;
}

function toAggregated(pack: PackName, s: Scenario | { id: string; title: string; description: string; components: ReadonlyArray<Readonly<Record<string, unknown>>> }): AggregatedScenario {
  return {
    pack,
    scenarioId: s.id,
    key: `${pack}/${s.id}`,
    title: s.title,
    description: s.description,
    components: s.components,
  };
}

export const SCENARIOS: readonly AggregatedScenario[] = Object.freeze([
  ...CORE_SCENARIOS.map((s) => toAggregated('core', s)),
  ...azureScenarios.map((s) => toAggregated('azure', s)),
  ...aksScenarios.map((s) => toAggregated('aks', s)),
  ...githubScenarios.map((s) => toAggregated('github', s)),
]);

/** Grouped by pack name, preserving declaration order within each pack. */
export function groupScenariosByPack(
  scenarios: readonly AggregatedScenario[] = SCENARIOS,
): ReadonlyMap<PackName, readonly AggregatedScenario[]> {
  const map = new Map<PackName, AggregatedScenario[]>();
  for (const s of scenarios) {
    const bucket = map.get(s.pack) ?? [];
    bucket.push(s);
    map.set(s.pack, bucket);
  }
  return map;
}
