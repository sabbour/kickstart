/**
 * Model resolution — maps a ModelRef to a deployment name.
 *
 * Fallback chain is tier-aware:
 *   KICKSTART_CODEX_MODEL → AZURE_OPENAI_CODEX_DEPLOYMENT → AZURE_OPENAI_DEPLOYMENT
 *   KICKSTART_CHAT_MODEL  → AZURE_OPENAI_CHAT_DEPLOYMENT  → AZURE_OPENAI_DEPLOYMENT
 *
 * Cross-tier fallback is intentionally blocked: a missing KICKSTART_CODEX_MODEL
 * will NOT silently route to AZURE_OPENAI_CHAT_DEPLOYMENT, preventing silent
 * model misrouting when operators partially configure the deployment split.
 */

import type { ModelRef } from '../types/agent.js';

const CODEX_TIER_VAR = 'KICKSTART_CODEX_MODEL';

export function resolveModelName(ref: ModelRef): string {
  if (!('envVar' in ref)) {
    return ref.id;
  }

  const primary = process.env[ref.envVar];
  if (primary) return primary;

  // Tier-aware fallback: codex agents must not fall through to chat deployments
  const isCodexTier = ref.envVar === CODEX_TIER_VAR;
  const tierFallbackVar = isCodexTier ? 'AZURE_OPENAI_CODEX_DEPLOYMENT' : 'AZURE_OPENAI_CHAT_DEPLOYMENT';
  const tierFallback = process.env[tierFallbackVar];
  const genericFallback = process.env.AZURE_OPENAI_DEPLOYMENT;

  const resolved = tierFallback ?? genericFallback;
  if (resolved) {
    const usedVar = tierFallback ? tierFallbackVar : 'AZURE_OPENAI_DEPLOYMENT';
    console.warn(`[harness] Model env var ${ref.envVar} not set — falling back to ${usedVar}`);
    return resolved;
  }

  // Log full diagnostic server-side; keep user-facing message generic
  console.error(
    `[harness] Model not configured. Checked: ${ref.envVar}, ${tierFallbackVar}, AZURE_OPENAI_DEPLOYMENT`,
  );
  throw new Error('Agent model is not configured. Contact your administrator.');
}
