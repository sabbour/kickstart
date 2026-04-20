import type { Pack } from '@kickstart/harness';
import { PackRegistry } from '@kickstart/harness/runtime/registry';
import { corePackServer } from '../../../../pack-core/src/server-manifest.js';
import { azurePackServer } from '../../../../pack-azure/src/server-manifest.js';
import { aksAutomaticPackServer } from '../../../../pack-aks-automatic/src/server-manifest.js';
import { githubPackServer } from '../../../../pack-github/src/server-manifest.js';

let _registry: PackRegistry | null = null;

/**
 * Pack identifiers understood by `KICKSTART_PACKS`. The order here defines
 * the dependency-safe registration order: `core` → `azure` → `aks` → `github`.
 */
const PACK_ORDER = ['core', 'azure', 'aks', 'github'] as const;
type PackId = (typeof PACK_ORDER)[number];

const PACK_BY_ID: Record<PackId, Pack> = {
  core: corePackServer,
  azure: azurePackServer,
  aks: aksAutomaticPackServer,
  github: githubPackServer,
};

function parseEnabledPacks(raw: string | undefined): PackId[] {
  if (!raw || raw.trim() === '') {
    return [...PACK_ORDER];
  }
  const requested = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  // `core` is always registered — everything else depends on it.
  requested.add('core');
  return PACK_ORDER.filter((id): id is PackId => requested.has(id));
}

/**
 * Returns the sealed PackRegistry singleton.
 *
 * Registers the configured packs in dependency order and seals on first
 * call; subsequent calls return the same sealed instance (safe for Azure
 * Functions warm-start sharing).
 *
 * The enabled pack set is controlled by `KICKSTART_PACKS` (comma-separated
 * list of pack ids: `core`, `azure`, `aks`, `github`). When unset or empty,
 * all four packs are enabled. `core` is always registered regardless of
 * configuration because every other pack depends on it.
 */
export function getRegistry(): PackRegistry {
  if (!_registry) {
    const registry = new PackRegistry();
    const enabled = parseEnabledPacks(process.env.KICKSTART_PACKS);
    for (const id of enabled) {
      registry.register(PACK_BY_ID[id]);
    }
    registry.seal();
    _registry = registry;
  }
  return _registry;
}
