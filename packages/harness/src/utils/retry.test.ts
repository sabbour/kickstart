/**
 * Unit tests for withRetry() and CircuitBreaker (#102).
 */

import { describe, expect, it, vi } from 'vitest';
import { withRetry, CircuitBreaker, CircuitOpenError } from './retry.js';

// Override sleep so tests don't actually wait.
vi.mock('./retry.js', async () => {
  const actual = await vi.importActual<typeof import('./retry.js')>('./retry.js');
  // Re-export everything, but intercept the module-internal sleep by making
  // withRetry use delay=0 in tests. We do this by overriding baseDelayMs.
  return actual;
});

// Helper to build an error with an HTTP status code (mirrors openai SDK shape).
function httpError(status: number): Error & { status: number } {
  const err = new Error(`HTTP ${status}`) as Error & { status: number };
  err.status = status;
  return err;
}

describe('withRetry', () => {
  it('returns immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { retryOn: [429, 500], maxAttempts: 3, baseDelayMs: 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 up to maxAttempts', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(httpError(429))
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValue('success');
    const onRetry = vi.fn();
    const result = await withRetry(fn, { retryOn: [429, 500], maxAttempts: 3, baseDelayMs: 0, onRetry });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('retries on 500 and 503', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(httpError(500))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, { retryOn: [429, 500, 503], maxAttempts: 3, baseDelayMs: 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 401 (non-retryable 4xx)', async () => {
    const err = httpError(401);
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { retryOn: [429, 500], maxAttempts: 3, baseDelayMs: 0 }))
      .rejects.toThrow('HTTP 401');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 403 (non-retryable 4xx)', async () => {
    const fn = vi.fn().mockRejectedValue(httpError(403));
    await expect(withRetry(fn, { retryOn: [429, 500], maxAttempts: 3, baseDelayMs: 0 }))
      .rejects.toThrow('HTTP 403');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 400 (non-retryable 4xx)', async () => {
    const fn = vi.fn().mockRejectedValue(httpError(400));
    await expect(withRetry(fn, { retryOn: [429, 500], maxAttempts: 3, baseDelayMs: 0 }))
      .rejects.toThrow('HTTP 400');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts maxAttempts and re-throws the last error', async () => {
    const err = httpError(429);
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { retryOn: [429], maxAttempts: 3, baseDelayMs: 0 }))
      .rejects.toThrow('HTTP 429');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry AbortError', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    const fn = vi.fn().mockRejectedValue(abortErr);
    await expect(withRetry(fn, { retryOn: [429, 500], maxAttempts: 3, baseDelayMs: 0 }))
      .rejects.toThrow('aborted');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry with attempt and error', async () => {
    const err = httpError(500);
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('done');
    await withRetry(fn, { retryOn: [500], maxAttempts: 3, baseDelayMs: 0, onRetry });
    expect(onRetry).toHaveBeenCalledWith(1, err);
  });
});

describe('CircuitBreaker', () => {
  it('starts closed', () => {
    const cb = new CircuitBreaker(5);
    expect(cb.isOpen).toBe(false);
  });

  it('opens after threshold consecutive failures', () => {
    const cb = new CircuitBreaker(5);
    for (let i = 0; i < 5; i++) cb.recordFailure();
    expect(cb.isOpen).toBe(true);
  });

  it('does not open before threshold', () => {
    const cb = new CircuitBreaker(5);
    for (let i = 0; i < 4; i++) cb.recordFailure();
    expect(cb.isOpen).toBe(false);
  });

  it('resets on recordSuccess()', () => {
    const cb = new CircuitBreaker(5);
    for (let i = 0; i < 5; i++) cb.recordFailure();
    expect(cb.isOpen).toBe(true);
    cb.recordSuccess();
    expect(cb.isOpen).toBe(false);
  });

  it('reset() clears the counter', () => {
    const cb = new CircuitBreaker(5);
    for (let i = 0; i < 5; i++) cb.recordFailure();
    cb.reset();
    expect(cb.isOpen).toBe(false);
  });

  it('CircuitOpenError has the right name', () => {
    const err = new CircuitOpenError();
    expect(err.name).toBe('CircuitOpenError');
  });
});
