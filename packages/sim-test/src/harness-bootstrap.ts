/**
 * Minimal pack registry bootstrap for CLI scripts.
 *
 * Mirrors the logic in `packages/web/api/src/startup/packs.ts` but strips
 * the Azure Functions infrastructure (AppInsights, Logger) to keep the CLI
 * dependency-free.
 *
 * Requires environment variables for at least one LLM provider:
 *   - Azure OpenAI: AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY
 *   - Standard OpenAI: OPENAI_API_KEY
 *
 * Optional: KICKSTART_PACKS=core,azure,aks,github (comma-separated, default: all)
 */

import { PackRegistry } from '@aks-kickstart/harness/runtime/registry';
import type { Pack } from '@aks-kickstart/harness';
// Pack server manifests — resolved via tsconfig.scripts.json paths aliases
// to local source .ts files so no build step is required for CLI use.
import { corePackServer } from '@aks-kickstart/pack-core/server-manifest';
import { azurePackServer } from '@aks-kickstart/pack-azure/server-manifest';
import { aksAutomaticPackServer } from '@aks-kickstart/pack-aks-automatic/server-manifest';
import { githubPackServer } from '@aks-kickstart/pack-github/server-manifest';

const PACK_ORDER = ['core', 'azure', 'aks', 'github'] as const;
type PackId = (typeof PACK_ORDER)[number];

const PACK_BY_ID: Record<PackId, Pack> = {
  core: corePackServer,
  azure: azurePackServer,
  aks: aksAutomaticPackServer,
  github: githubPackServer,
};

function parseEnabledPacks(raw: string | undefined): PackId[] {
  if (!raw || raw.trim() === '') return [...PACK_ORDER];
  const requested = new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  requested.add('core');
  return PACK_ORDER.filter((id): id is PackId => requested.has(id));
}

/** Check that at least one LLM provider is configured. */
export function assertCredentials(): void {
  const hasAzure =
    process.env.AZURE_OPENAI_ENDPOINT?.trim() && process.env.AZURE_OPENAI_API_KEY?.trim();
  const hasOpenAI = process.env.OPENAI_API_KEY?.trim();

  if (!hasAzure && !hasOpenAI) {
    console.error(
      'Error: No LLM provider configured.\n' +
        'Set one of:\n' +
        '  Azure OpenAI: AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY\n' +
        '  Standard OpenAI: OPENAI_API_KEY',
    );
    process.exit(1);
  }
}

/**
 * Print a clear bootstrap summary so it's obvious which harness and model
 * provider the probe/sim is running against.
 *
 * Always write to stderr so it doesn't pollute the probe's JSON stdout.
 */
export function printBootstrapSummary(label = 'probe'): void {
  const div = '─'.repeat(60);
  const lines: string[] = [`[${label}] ${div}`];

  lines.push(`[${label}] Harness : LOCAL (packages/* source, no build)`);

  // LLM provider
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const hasAzureKey   = !!process.env.AZURE_OPENAI_API_KEY?.trim();
  const hasOpenAI     = !!process.env.OPENAI_API_KEY?.trim();

  if (azureEndpoint && hasAzureKey) {
    // Mask key — show host only
    const host = (() => { try { return new URL(azureEndpoint).host; } catch { return azureEndpoint; } })();
    lines.push(`[${label}] Provider: Azure OpenAI  →  ${host}`);
  } else if (hasOpenAI) {
    lines.push(`[${label}] Provider: OpenAI (OPENAI_API_KEY)`);
  }

  // Azure credentials (ARM / quota)
  const hasArmToken = !!process.env.AZURE_ACCESS_TOKEN?.trim();
  const hasMsalTenant = !!process.env.AZURE_TENANT_ID?.trim();
  if (hasArmToken || hasMsalTenant) {
    lines.push(`[${label}] Azure   : ARM token ${hasArmToken ? '✓' : '✗'}  tenant ${hasMsalTenant ? '✓' : '✗'} (quota + resource ops)`);
  } else {
    lines.push(`[${label}] Azure   : no ARM token — quota will be unknown, pricing-only mode`);
  }

  // Packs
  const packs = parseEnabledPacks(process.env.KICKSTART_PACKS);
  lines.push(`[${label}] Packs   : ${packs.join(', ')}`);

  lines.push(`[${label}] ${div}`);

  for (const l of lines) process.stderr.write(l + '\n');
}

/**
 * Build and seal a PackRegistry for CLI use.
 *
 * Fail-soft on non-core packs (same policy as the web API). Core pack failure
 * is always fatal.
 */
export function buildCliRegistry(): PackRegistry {
  const registry = new PackRegistry();
  const enabled = parseEnabledPacks(process.env.KICKSTART_PACKS);

  for (const id of enabled) {
    try {
      registry.register(PACK_BY_ID[id]);
    } catch (err) {
      if (id === 'core') throw err;
      console.warn(`[harness-bootstrap] Pack '${id}' failed to load — skipping`, err);
    }
  }

  registry.seal();
  return registry;
}
