/**
 * Unit tests for buildAzureBaseUrl() and buildModelProvider() — runner.ts
 *
 * Covers the regression in issue #932: all /api/converse calls failed with
 * HTTP 404 "Resource not found" because the Azure baseURL was built as
 * `.../openai`, causing the SDK to hit `/openai/chat/completions` — a path
 * Azure OpenAI does not serve. The fix targets the v1 endpoint so the SDK
 * resolves `/openai/v1/chat/completions`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '@openai/agents';
import { buildAzureBaseUrl, buildModelProvider, isResponsesApiEnabled, resolveOutputText, stripHandoffComment } from '../../src/runtime/runner.js';

describe('buildAzureBaseUrl', () => {
  it('appends /openai/v1 when endpoint has no trailing slash', () => {
    expect(buildAzureBaseUrl('https://my-resource.openai.azure.com'))
      .toBe('https://my-resource.openai.azure.com/openai/v1');
  });

  it('strips trailing slash and appends /openai/v1', () => {
    expect(buildAzureBaseUrl('https://my-resource.openai.azure.com/'))
      .toBe('https://my-resource.openai.azure.com/openai/v1');
  });

  it('handles endpoints that include a subpath without trailing slash', () => {
    expect(buildAzureBaseUrl('https://my-resource.openai.azure.com/custom'))
      .toBe('https://my-resource.openai.azure.com/custom/openai/v1');
  });

  it('does NOT produce the broken /openai path that returned 404 (regression guard for #932)', () => {
    // Azure OpenAI does not serve /openai/chat/completions — only
    // /openai/v1/chat/completions or /openai/deployments/{name}/chat/completions.
    const result = buildAzureBaseUrl('https://my-resource.openai.azure.com');
    expect(result).not.toMatch(/\/openai$/);
    expect(result).toMatch(/\/openai\/v1$/);
  });
});

describe('buildModelProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns an OpenAIProvider configured for Azure when AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY are set', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubEnv('AZURE_OPENAI_ENDPOINT', 'https://my-resource.openai.azure.com');
    vi.stubEnv('AZURE_OPENAI_API_KEY', 'fake-key');

    const provider = buildModelProvider();
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(console.log).toHaveBeenCalledWith('[runner] Building model provider: Azure OpenAI');
  });

  it('falls back to Standard OpenAI provider when AZURE_OPENAI_ENDPOINT is absent', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubEnv('AZURE_OPENAI_ENDPOINT', '');
    vi.stubEnv('AZURE_OPENAI_API_KEY', 'fake-key');

    const provider = buildModelProvider();
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(console.log).toHaveBeenCalledWith(
      '[runner] Building model provider: Standard OpenAI (or dev/test fallback)',
    );
  });

  it('falls back to Standard OpenAI provider when AZURE_OPENAI_API_KEY is absent', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubEnv('AZURE_OPENAI_ENDPOINT', 'https://my-resource.openai.azure.com');
    vi.stubEnv('AZURE_OPENAI_API_KEY', '');

    const provider = buildModelProvider();
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(console.log).toHaveBeenCalledWith(
      '[runner] Building model provider: Standard OpenAI (or dev/test fallback)',
    );
  });
});

// ---------------------------------------------------------------------------
// isResponsesApiEnabled — feature flag (Phase 1 of #114)
// ---------------------------------------------------------------------------

describe('isResponsesApiEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false when KICKSTART_USE_RESPONSES is absent', () => {
    vi.stubEnv('KICKSTART_USE_RESPONSES', '');
    expect(isResponsesApiEnabled()).toBe(false);
  });

  it('returns true when KICKSTART_USE_RESPONSES is "1"', () => {
    vi.stubEnv('KICKSTART_USE_RESPONSES', '1');
    expect(isResponsesApiEnabled()).toBe(true);
  });

  it('returns true when KICKSTART_USE_RESPONSES is "true"', () => {
    vi.stubEnv('KICKSTART_USE_RESPONSES', 'true');
    expect(isResponsesApiEnabled()).toBe(true);
  });

  it('returns false when KICKSTART_USE_RESPONSES is "0"', () => {
    vi.stubEnv('KICKSTART_USE_RESPONSES', '0');
    expect(isResponsesApiEnabled()).toBe(false);
  });

  it('returns false when KICKSTART_USE_RESPONSES is "false"', () => {
    vi.stubEnv('KICKSTART_USE_RESPONSES', 'false');
    expect(isResponsesApiEnabled()).toBe(false);
  });

  it('returns true when KICKSTART_USE_RESPONSES is "yes"', () => {
    vi.stubEnv('KICKSTART_USE_RESPONSES', 'yes');
    expect(isResponsesApiEnabled()).toBe(true);
  });

  it('is case-insensitive (TRUE → true)', () => {
    vi.stubEnv('KICKSTART_USE_RESPONSES', 'TRUE');
    expect(isResponsesApiEnabled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveOutputText — prose extraction (#937)
// ---------------------------------------------------------------------------

describe('resolveOutputText', () => {
  it('returns finalOutput.message when the SDK finalOutput is a parsed AgentOutput object', () => {
    const finalOutput = { message: 'Great idea — I can help with that.', intent: 'continue' };
    const fullText = '{"message":"Great idea — I can help with that.","intent":"continue"}';
    expect(resolveOutputText(finalOutput, fullText)).toBe('Great idea — I can help with that.');
  });

  it('falls back to fullText when finalOutput is null (interrupted run)', () => {
    expect(resolveOutputText(null, 'raw-stream-text')).toBe('raw-stream-text');
  });

  it('falls back to fullText when finalOutput is undefined', () => {
    expect(resolveOutputText(undefined, 'fallback')).toBe('fallback');
  });

  it('falls back to fullText when finalOutput.message is not a string', () => {
    expect(resolveOutputText({ message: 42 }, 'fallback')).toBe('fallback');
  });

  it('returns empty string when finalOutput has no message field (surface-only turn #1130)', () => {
    // AgentOutput.message is optional — surface-only turns emit UI with no prose
    expect(resolveOutputText({ intent: 'continue' }, 'plain text')).toBe('');
  });

  it('returns empty string when finalOutput.message is null (strict-mode surface-only turn #90)', () => {
    // OpenAI strict-mode: model sends null for absent fields instead of omitting them
    expect(resolveOutputText({ message: null, intent: 'continue' }, 'plain text')).toBe('');
  });

  it('returns the string directly when finalOutput is a plain string (text output mode)', () => {
    expect(resolveOutputText('plain text response', '')).toBe('plain text response');
  });

  it('does NOT return raw JSON string when finalOutput.message is the clean prose (regression guard for #937)', () => {
    const jsonTokenStream = '{"message":"Hello there","intent":"continue"}';
    const finalOutput = { message: 'Hello there', intent: 'continue' };
    const result = resolveOutputText(finalOutput, jsonTokenStream);
    // Must be clean prose, not the JSON-encoded token stream
    expect(result).toBe('Hello there');
    expect(result).not.toContain('{');
  });
});

describe('stripHandoffComment (#415)', () => {
  it('strips a triage-handoff/v1 HTML comment from message text', () => {
    const input = 'Routing you to the AKS Architect.\n<!-- triage-handoff/v1\n{"version":"triage-handoff/v1"}\n-->';
    expect(stripHandoffComment(input)).toBe('Routing you to the AKS Architect.');
  });

  it('leaves text unchanged when no handoff comment is present', () => {
    const input = 'Hello, how can I help you today?';
    expect(stripHandoffComment(input)).toBe(input);
  });

  it('handles multi-line briefing JSON inside the comment', () => {
    const input = 'On it.\n<!-- triage-handoff/v1\n{\n  "version": "triage-handoff/v1",\n  "mode": "greenfield"\n}\n-->';
    expect(stripHandoffComment(input)).toBe('On it.');
  });

  it('strips comment even with extra whitespace after triage-handoff/v1 marker', () => {
    const input = 'Summary.\n<!--  triage-handoff/v1  \n{"version":"triage-handoff/v1"}\n-->';
    expect(stripHandoffComment(input)).toBe('Summary.');
  });

  it('does NOT strip unrelated HTML comments', () => {
    const input = 'Text <!-- regular comment --> more text';
    expect(stripHandoffComment(input)).toBe(input);
  });
});
