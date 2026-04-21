import { describe, it, expect, beforeEach, vi } from 'vitest';
import { healthCheck } from './api-client';

describe('healthCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok: true on successful health check (200)', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', registry: 'ready' }), { status: 200 })
    );

    const result = await healthCheck();

    expect(result).toEqual({ ok: true });
  });

  it('extracts error details from 503 response with structured error', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'error',
          phase: 'env-validation',
          message: 'Pack registry initialization failed',
          detail: 'AZURE_OPENAI_KEY is not set',
          hint: 'Ensure AZURE_OPENAI_KEY and AZURE_OPENAI_ENDPOINT environment variables are set',
        }),
        { status: 503 }
      )
    );

    const result = await healthCheck();

    expect(result.ok).toBe(false);
    expect(result.error).toEqual({
      phase: 'env-validation',
      message: 'AZURE_OPENAI_KEY is not set',
      hint: 'Ensure AZURE_OPENAI_KEY and AZURE_OPENAI_ENDPOINT environment variables are set',
    });
  });

  it('returns network error on fetch timeout', async () => {
    const timeoutError = new Error('The operation was aborted.');
    Object.defineProperty(timeoutError, 'name', { value: 'AbortError' });

    global.fetch = vi.fn().mockRejectedValue(timeoutError);

    const result = await healthCheck();

    expect(result.ok).toBe(false);
    expect(result.error?.phase).toBe('api-timeout');
  });

  it('returns unreachable error on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const result = await healthCheck();

    expect(result.ok).toBe(false);
    expect(result.error?.phase).toBe('api-unreachable');
  });

  it('handles error response without structured body', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('Internal Server Error', { status: 500 })
    );

    const result = await healthCheck();

    expect(result.ok).toBe(false);
    expect(result.error?.phase).toBe('api-error');
    expect(result.error?.message).toContain('500');
  });
});
