/**
 * Unit tests for resolveModelName() — model-resolution.ts
 *
 * Covers:
 * - Primary env var set → returns it directly, no fallback
 * - KICKSTART_CHAT_MODEL unset, tier-correct fallback (AZURE_OPENAI_CHAT_DEPLOYMENT) set → uses it + warns
 * - KICKSTART_CODEX_MODEL unset, tier-correct fallback (AZURE_OPENAI_CODEX_DEPLOYMENT) set → uses it + warns
 * - KICKSTART_CODEX_MODEL unset, cross-tier fallback only (AZURE_OPENAI_CHAT_DEPLOYMENT) set → throws (tier mismatch)
 * - KICKSTART_CHAT_MODEL unset, tier fallback unset, AZURE_OPENAI_DEPLOYMENT set → uses generic + warns
 * - All unset → throws user-friendly error without raw env var names
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

  it('returns primary env var when set', () => {
    vi.stubEnv('KICKSTART_CHAT_MODEL', 'gpt-5.4-mini');
    expect(resolveModelName({ envVar: 'KICKSTART_CHAT_MODEL' })).toBe('gpt-5.4-mini');
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
    // AZURE_OPENAI_CODEX_DEPLOYMENT and AZURE_OPENAI_DEPLOYMENT are unset
    expect(() => resolveModelName({ envVar: 'KICKSTART_CODEX_MODEL' })).toThrow(
      'Agent model is not configured. Contact your administrator.',
    );
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('falls back to generic AZURE_OPENAI_DEPLOYMENT when tier-specific fallback unset, and logs a warning', () => {
    vi.stubEnv('AZURE_OPENAI_DEPLOYMENT', 'generic-deployment');
    const result = resolveModelName({ envVar: 'KICKSTART_CHAT_MODEL' });
    expect(result).toBe('generic-deployment');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('AZURE_OPENAI_DEPLOYMENT'),
    );
  });

  it('throws user-friendly error when all env vars are unset', () => {
    expect(() => resolveModelName({ envVar: 'KICKSTART_CHAT_MODEL' })).toThrow(
      'Agent model is not configured. Contact your administrator.',
    );
    // Must NOT leak the raw env var name to the thrown message
    let thrown: Error | undefined;
    try {
      resolveModelName({ envVar: 'KICKSTART_CHAT_MODEL' });
    } catch (e) {
      thrown = e as Error;
    }
    expect(thrown?.message).not.toContain('KICKSTART_CHAT_MODEL');
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
