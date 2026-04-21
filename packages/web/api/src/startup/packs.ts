import type { Pack } from '@aks-kickstart/harness';
import { PackRegistry } from '@aks-kickstart/harness/runtime/registry';
import { Logger } from '../lib/logger.js';
import { getAppInsightsClient, flushAppInsights } from '../lib/appinsights.js';
import { corePackServer } from '../../../../pack-core/src/server-manifest.js';
import { azurePackServer } from '../../../../pack-azure/src/server-manifest.js';
import { aksAutomaticPackServer } from '../../../../pack-aks-automatic/src/server-manifest.js';
import { githubPackServer } from '../../../../pack-github/src/server-manifest.js';
import { randomUUID } from 'crypto';
import { getCredentialConfig } from './credentials.js';

let _registry: PackRegistry | null = null;
let _loadErrors: PackLoadError[] = [];

export type PackLoadErrorReason = 'schema_validation' | 'parse_error' | 'unknown';

export interface PackLoadError {
  packId: string;
  reason: PackLoadErrorReason;
}

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
  requested.add('core');
  return PACK_ORDER.filter((id): id is PackId => requested.has(id));
}

function classifyLoadError(err: unknown): PackLoadErrorReason {
  if (
    err !== null &&
    typeof err === 'object' &&
    'issues' in err &&
    Array.isArray((err as Record<string, unknown>).issues)
  ) {
    return 'schema_validation';
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('frontmatter') || msg.includes('yaml') || msg.includes('parse')) {
      return 'parse_error';
    }
  }
  return 'unknown';
}


/**
 * Returns the pack load errors collected during the last registry initialization.
 * Returns an empty array when all packs loaded successfully.
 * Resets automatically on the next successful `getRegistry()` call.
 */
export function getLoadErrors(): PackLoadError[] {
  return [..._loadErrors];
}

/**
 * Reset module state — exposed for testing only.
 * @internal
 */
export function _resetRegistryState(): void {
  _registry = null;
  _loadErrors = [];
}

/**
 * Returns the sealed PackRegistry singleton.
 *
 * Registers the configured packs in dependency order and seals on first
 * call; subsequent calls return the same sealed instance (safe for Azure
 * Functions warm-start sharing).
 *
 * Fail-soft: if a non-core pack fails to register (e.g. bad SKILL.md
 * frontmatter), it is quarantined — its error is recorded in `loadErrors[]`
 * and healthy packs continue to load. The registry seals and the API stays up.
 *
 * Hard stop: if the `core` pack fails (it is a universal dependency for every
 * agent and every other pack), the error is rethrown immediately and the
 * registry is not set.
 *
 * Callers can inspect `getLoadErrors()` to surface degraded state to operators.
 */
export function getRegistry(): PackRegistry {
  if (!_registry) {
    // Reset load errors on each fresh initialization attempt.
    _loadErrors = [];

    const startupTraceId = process.env.STARTUP_TRACE_ID || randomUUID();
    const mockCtx = {
      log: (msg: string) => {
        if (process.env.NODE_ENV !== 'test') {
          console.log(msg);
        }
      },
    };

    const logger = new Logger(mockCtx as any, 'pack-registry-startup', startupTraceId);

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

    logger.info('Pack registry initialization started', {
      source: 'startup',
      enabled_packs: enabled,
      pack_count: enabled.length,
    });

    for (const id of enabled) {
      const packStartTime = Date.now();
      try {
        logger.info('Registering pack', {
          source: 'startup',
          pack_id: id,
        });

        registry.register(PACK_BY_ID[id]);

        const duration = Date.now() - packStartTime;
        logger.info('Pack registered successfully', {
          source: 'startup',
          pack_id: id,
          status: 'success',
          duration_ms: duration,
        });
      } catch (err) {
        const duration = Date.now() - packStartTime;
        logger.error('Pack registration failed', err as Error, {
          source: 'startup',
          pack_id: id,
          error_code: 'MANIFEST_LOAD_FAILED',
          duration_ms: duration,
        });

        // Leela C1: core pack failure is always a hard stop.
        // Every agent and every other pack depends on core.
        if (id === 'core') {
          // Emit telemetry before rethrowing — non-masking: telemetry failure
          // must never prevent the original error from propagating.
          // Fire-and-forget: getRegistry() is sync; the calling handler's own
          // catch block also calls trackException + flushAppInsights() with await.
          try {
            getAppInsightsClient().trackException({
              exception: err instanceof Error ? err : new Error(String(err)),
              properties: { packId: id, context: 'core-pack-registration-failed' },
            });
            void flushAppInsights();
          } catch { /* telemetry errors do not mask the original throw */ }
          throw err;
        }

        // Non-core packs: quarantine and continue.
        _loadErrors.push({ packId: id, reason: classifyLoadError(err) });
      }
    }

    try {
      const sealStartTime = Date.now();
      logger.info('Sealing registry', {
        source: 'startup',
      });

      registry.seal();

      const duration = Date.now() - sealStartTime;
      logger.info('Registry sealed successfully', {
        source: 'startup',
        pack_count: enabled.length - _loadErrors.length,
        load_errors: _loadErrors.length,
        duration_ms: duration,
      });
    } catch (err) {
      logger.error('Failed to seal registry', err as Error, {
        source: 'startup',
        error_code: 'REGISTRY_SEAL_FAILED',
      });
      try {
        getAppInsightsClient().trackException({
          exception: err instanceof Error ? err : new Error(String(err)),
          properties: { context: 'registry-seal-failed' },
        });
        void flushAppInsights();
      } catch { /* telemetry errors do not mask the original throw */ }
      throw err;
    }

    _registry = registry;
  }
  return _registry;
}


