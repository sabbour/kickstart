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
import { buildAzureBaseUrl, buildModelProvider } from '../../src/runtime/runner.js';

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
