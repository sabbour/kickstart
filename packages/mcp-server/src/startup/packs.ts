/**
 * @module @aks-kickstart/mcp-server/startup/packs
 *
 * MCP-server pack registration. Mirrors packages/web/api/src/startup/packs.ts
 * so the MCP runtime and the web API expose the same sealed PackRegistry shape.
 *
 * Both surfaces honour `KICKSTART_PACKS` (comma-separated list) and always
 * register `core` first because every other pack depends on it.
 */

import type { Pack } from '@aks-kickstart/harness';
import { PackRegistry } from '@aks-kickstart/harness';
import { corePackServer } from '@aks-kickstart/pack-core/server-manifest';
import { azurePackServer } from '@aks-kickstart/pack-azure/server-manifest';
import { aksAutomaticPackServer } from '@aks-kickstart/pack-aks-automatic/server-manifest';
import { githubPackServer } from '@aks-kickstart/pack-github/server-manifest';

let _registry: PackRegistry | null = null;

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
 * Returns the sealed PackRegistry singleton for the MCP server.
 *
 * Registers the configured packs in dependency order and seals on first
 * call. The enabled pack set is controlled by `KICKSTART_PACKS`
 * (comma-separated list: `core`, `azure`, `aks`, `github`). When unset or
 * empty, all four packs are enabled. `core` is always registered.
 */
export function getRegistry(): PackRegistry {
  if (!_registry) {
    _registry = new PackRegistry();
    const enabled = parseEnabledPacks(process.env['KICKSTART_PACKS']);
    for (const id of enabled) {
      _registry.register(PACK_BY_ID[id]);
    }
    _registry.seal();
    process.stderr.write(
      `[kickstart-mcp] registered packs: ${enabled.join(', ')}\n`,
    );
  }
  return _registry;
}
