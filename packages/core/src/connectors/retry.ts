/**
 * Retry utilities with exponential backoff + jitter + Retry-After support.
 */

import type { RetryConfig } from './types.js';
import { ConnectorError, DEFAULT_RETRY_CONFIG } from './types.js';

/**
 * Calculate delay for attempt N using exponential backoff with jitter.
 *
 * Formula: min(baseDelay × 2^attempt + jitter, maxDelay)
 * Jitter is a random value in [0, baseDelay × jitterFactor].
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponential = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * config.baseDelayMs * config.jitterFactor;
  return Math.min(exponential + jitter, config.maxDelayMs);
}

/**
 * Parse a Retry-After header value into milliseconds to wait.
 *
 * Supports two formats per RFC 7231 §7.1.3:
 * - Seconds as an integer (e.g. "120")
 * - HTTP-date (e.g. "Thu, 01 Jan 2026 00:00:00 GMT")
 *
 * Returns `null` if the header is missing or unparseable.
 */
export function parseRetryAfter(headerValue: string | null): number | null {
  if (headerValue === null || headerValue === '') return null;

  // Try integer seconds first
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  // Try HTTP-date
  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    const delayMs = dateMs - Date.now();
    return delayMs > 0 ? delayMs : 0;
  }

  return null;
}

/**
 * Execute an async operation with retry logic.
 *
 * On retryable failures (based on HTTP status or network errors), waits with
 * exponential backoff + jitter, honoring any Retry-After header.
 *
 * @param fn - The async function to execute.  Receives the current attempt
 *             number (0-based).
 * @param config - Partial retry config; missing fields fall back to defaults.
 * @returns The Response from a successful attempt.
 * @throws ConnectorError if all retries are exhausted.
 */
export async function withRetry(
  fn: (attempt: number) => Promise<Response>,
  config?: Partial<RetryConfig>,
): Promise<Response> {
  const resolved: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= resolved.maxRetries; attempt++) {
    try {
      const response = await fn(attempt);

      // Non-retryable status → return immediately (caller decides what to do)
      if (!resolved.retryableStatuses.includes(response.status)) {
        return response;
      }

      // Retryable status — but if we're out of retries, return as-is
      if (attempt === resolved.maxRetries) {
        return response;
      }

      // Calculate wait time, preferring Retry-After header
      const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));
      const backoffMs = calculateDelay(attempt, resolved);
      const waitMs = retryAfterMs !== null ? Math.max(retryAfterMs, backoffMs) : backoffMs;

      await sleep(waitMs);
    } catch (error: unknown) {
      lastError = error;

      // Don't retry if caller aborted
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ConnectorError('Request aborted', 'TIMEOUT', {
          retryable: false,
          cause: error,
        });
      }

      // Out of retries → throw
      if (attempt === resolved.maxRetries) {
        throw new ConnectorError(
          `Request failed after ${resolved.maxRetries + 1} attempts`,
          'NETWORK_ERROR',
          { retryable: false, cause: lastError },
        );
      }

      await sleep(calculateDelay(attempt, resolved));
    }
  }

  // Should be unreachable, but TypeScript needs the return path
  throw new ConnectorError('Retry loop exited unexpectedly', 'UNKNOWN', {
    cause: lastError,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
