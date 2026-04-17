import { PackRegistry } from '@kickstart/harness/runtime/registry';
import { corePackServer } from '../../../../pack-core/src/server-manifest.js';

let _registry: PackRegistry | null = null;

/**
 * Returns the sealed PackRegistry singleton.
 * Registers corePack and seals on first call; subsequent calls return the
 * same sealed instance (safe for Azure Functions warm-start sharing).
 */
export function getRegistry(): PackRegistry {
  if (!_registry) {
    _registry = new PackRegistry();
    _registry.register(corePackServer);
    _registry.seal();
  }
  return _registry;
}
