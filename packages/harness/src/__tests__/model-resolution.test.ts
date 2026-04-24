/**
 * Unit tests for resolveModelName() — model-resolution.ts
 *
 * Covers:
 * - KICKSTART_CHAT_MODEL unset + Azure fully configured (endpoint+key) → uses built-in gpt-5.4 default
 * - KICKSTART_CHAT_MODEL unset + Azure endpoint only (no key) → throws (runner would fall to OpenAI)
 * - KICKSTART_CHAT_MODEL unset + neither endpoint nor key → throws (fail-closed, data-egress guard)
 * - Primary env var set → returns it directly, no fallback
 * - KICKSTART_CHAT_MODEL unset, tier-correct fallback (AZURE_OPENAI_CHAT_DEPLOYMENT) set → uses it + warns
 * - KICKSTART_CODEX_MODEL unset, tier-correct fallback (AZURE_OPENAI_CODEX_DEPLOYMENT) set → uses it + warns
 * - KICKSTART_CODEX_MODEL unset, cross-tier fallback only (AZURE_OPENAI_CHAT_DEPLOYMENT) set → throws (tier mismatch)
 * - Codex tier all unset → throws user-friendly error without raw env var names
 * - ref.id shortcut → returns id without touching env
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveModelName } from '../../src/runtime/model-resolution.js';

describe('resolveModelName', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('defaults chat tier to gpt-5.4 when both Azure endpoint and API key are set', () => {
    vi.stubEnv('AZURE_OPENAI_ENDPOINT', 'https://my.openai.azure.com');
    vi.stubEnv('AZURE_OPENAI_API_KEY', 'test-key');
    expect(resolveModelName({ envVar: 'KICKSTART_CHAT_MODEL' })).toBe('gpt-5.4');
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('throws for chat tier when endpoint is set but API key is missing (would fall to OpenAI)', () => {
    vi.stubEnv('AZURE_OPENAI_ENDPOINT', 'https://my.openai.azure.com');
    // AZURE_OPENAI_API_KEY not set — runner would fall through to vanilla OpenAI
    expect(() => resolveModelName({ envVar: 'KICKSTART_CHAT_MODEL' })).toThrow(
      'Agent model is not configured. Contact your administrator.',
    );
  });

  it('throws for chat tier when neither Azure endpoint nor API key is configured (fail-closed)', () => {
    // No AZURE_OPENAI_ENDPOINT, no AZURE_OPENAI_API_KEY, no KICKSTART_CHAT_MODEL
    expect(() => resolveModelName({ envVar: 'KICKSTART_CHAT_MODEL' })).toThrow(
      'Agent model is not configured. Contact your administrator.',
    );
  });

  it('returns primary chat env var when set', () => {
    vi.stubEnv('KICKSTART_CHAT_MODEL', 'custom-model');
    expect(resolveModelName({ envVar: 'KICKSTART_CHAT_MODEL' })).toBe('custom-model');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('returns primary codex env var when set', () => {
    vi.stubEnv('KICKSTART_CODEX_MODEL', 'gpt-5.4');
    expect(resolveModelName({ envVar: 'KICKSTART_CODEX_MODEL' })).toBe('gpt-5.4');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('falls back to AZURE_OPENAI_CHAT_DEPLOYMENT for chat tier and logs a warning', () => {
    vi.stubEnv('AZURE_OPENAI_CHAT_DEPLOYMENT', 'chat-fallback');
    const result = resolveModelName({ envVar: 'KICKSTART_CHAT_MODEL' });
    expect(result).toBe('chat-fallback');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('KICKSTART_CHAT_MODEL'),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('AZURE_OPENAI_CHAT_DEPLOYMENT'),
    );
  });

  it('falls back to AZURE_OPENAI_CODEX_DEPLOYMENT for codex tier and logs a warning', () => {
    vi.stubEnv('AZURE_OPENAI_CODEX_DEPLOYMENT', 'codex-fallback');
    const result = resolveModelName({ envVar: 'KICKSTART_CODEX_MODEL' });
    expect(result).toBe('codex-fallback');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('KICKSTART_CODEX_MODEL'),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('AZURE_OPENAI_CODEX_DEPLOYMENT'),
    );
  });

  it('does NOT fall back to AZURE_OPENAI_CHAT_DEPLOYMENT for codex tier (tier mismatch)', () => {
    vi.stubEnv('AZURE_OPENAI_CHAT_DEPLOYMENT', 'chat-only');
    // AZURE_OPENAI_CODEX_DEPLOYMENT is unset — tier mismatch must throw
    expect(() => resolveModelName({ envVar: 'KICKSTART_CODEX_MODEL' })).toThrow(
      'Agent model is not configured. Contact your administrator.',
    );
    expect(console.warn).not.toHaveBeenCalled();
  });


  it('throws user-friendly error for codex tier when all env vars are unset', () => {
    expect(() => resolveModelName({ envVar: 'KICKSTART_CODEX_MODEL' })).toThrow(
      'Agent model is not configured. Contact your administrator.',
    );
    // Must NOT leak the raw env var name to the thrown message
    let thrown: Error | undefined;
    try {
      resolveModelName({ envVar: 'KICKSTART_CODEX_MODEL' });
    } catch (e) {
      thrown = e as Error;
    }
    expect(thrown?.message).not.toContain('KICKSTART_CODEX_MODEL');
    expect(thrown?.message).not.toContain('AZURE_OPENAI');
  });

  it('logs a server-side error when all env vars are unset', () => {
    try { resolveModelName({ envVar: 'KICKSTART_CODEX_MODEL' }); } catch { /* expected */ }
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('KICKSTART_CODEX_MODEL'),
    );
  });

  it('returns ref.id directly for static model refs', () => {
    expect(resolveModelName({ id: 'gpt-4o' })).toBe('gpt-4o');
    expect(console.warn).not.toHaveBeenCalled();
  });
});
