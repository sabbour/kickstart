import type { Pack } from '@aks-kickstart/harness';
import { PackRegistry } from '@aks-kickstart/harness/runtime/registry';
import { Logger } from '../lib/logger.js';
import { corePackServer } from '../../../../pack-core/src/server-manifest.js';
import { azurePackServer } from '../../../../pack-azure/src/server-manifest.js';
import { aksAutomaticPackServer } from '../../../../pack-aks-automatic/src/server-manifest.js';
import { githubPackServer } from '../../../../pack-github/src/server-manifest.js';
import { randomUUID } from 'crypto';
import { getCredentialConfig } from './credentials.js';

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
 *
 * Validates credentials on first call before registering packs. Throws if
 * pack initialization fails (e.g., manifest imports fail, assets cannot be
 * resolved, or credentials are misconfigured). Caller must handle and
 * recover gracefully.
 *
 * Logs startup events to Azure Application Insights via structured JSON logging.
 */
export function getRegistry(): PackRegistry {
  if (!_registry) {
    // Create a startup logger (trace ID for startup events)
    const startupTraceId = process.env.STARTUP_TRACE_ID || randomUUID();

    // Create a mock InvocationContext for startup logging
    // In a real Azure Functions environment, this would be the global context
    const mockCtx = {
      log: (msg: string) => {
        // In production, this routes to Application Insights via the Azure Functions runtime
        if (process.env.NODE_ENV !== 'test') {
          console.log(msg);
        }
      },
    };

    const logger = new Logger(mockCtx as any, 'pack-registry-startup', startupTraceId);

    // Validate credentials FIRST (fail fast if misconfigured)
    try {
      const credentialConfig = getCredentialConfig();
      logger.info('Credentials validated', {
        source: 'startup',
        llm_provider: credentialConfig.provider,
      });
    } catch (err) {
      logger.error('Credential validation failed', err as Error, {
        source: 'startup',
        error_code: 'CREDENTIAL_VALIDATION_FAILED',
      });
      throw err;
    }

    const registry = new PackRegistry();
    const enabled = parseEnabledPacks(process.env.KICKSTART_PACKS);

    logger.info("Pack registry initialization started", {
      source: "startup",
      enabled_packs: enabled,
      pack_count: enabled.length,
    });

    for (const id of enabled) {
      const packStartTime = Date.now();
      try {
        logger.info("Registering pack", {
          source: "startup",
          pack_id: id,
        });

        registry.register(PACK_BY_ID[id]);

        const duration = Date.now() - packStartTime;
        logger.info("Pack registered successfully", {
          source: "startup",
          pack_id: id,
          status: "success",
          duration_ms: duration,
        });
      } catch (err) {
        const duration = Date.now() - packStartTime;
        logger.error("Pack registration failed", err as Error, {
          source: "startup",
          pack_id: id,
          error_code: "MANIFEST_LOAD_FAILED",
          duration_ms: duration,
        });
        throw err;
      }
    }

    try {
      const sealStartTime = Date.now();
      logger.info("Sealing registry", {
        source: "startup",
      });

      registry.seal();

      const duration = Date.now() - sealStartTime;
      logger.info("Registry sealed successfully", {
        source: "startup",
        pack_count: enabled.length,
        duration_ms: duration,
      });
    } catch (err) {
      logger.error("Failed to seal registry", err as Error, {
        source: "startup",
        error_code: "REGISTRY_SEAL_FAILED",
      });
      throw err;
    }

    _registry = registry;
  }
  return _registry;
}
