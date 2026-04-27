/**
 * Retry / circuit-breaker utilities for the harness runtime.
 *
 * - `withRetry<T>`: exponential backoff with jitter for transient HTTP errors.
 * - `CircuitBreaker`: simple consecutive-failure counter; opens after a threshold.
 *
 * Security: retry logic is transport-level only. No credential material, PII,
 * or user content is passed through or logged here — callers pass opaque
 * async functions. The `onRetry` callback logs at warn level; callers must
 * ensure they do not pass sensitive data in error messages.
 */

export interface RetryOptions {
  /** HTTP status codes that should trigger a retry (e.g. [429, 500, 503]). */
  retryOn: number[];
  /**
   * Maximum total attempts (including the first call). Defaults to 3.
   * e.g. maxAttempts: 3 → up to 2 retries after the first failure.
   */
  maxAttempts?: number;
  backoff?: 'exponential';
  /** When true, adds `Math.random() * baseDelayMs` jitter to each delay. */
  jitter?: boolean;
  /** Base delay in ms before the first retry. Default: 500 ms. */
  baseDelayMs?: number;
  /** Hard cap on a single delay interval. Default: 10_000 ms. */
  maxDelayMs?: number;
  /** Called before each retry (not before the initial attempt). */
  onRetry?: (attempt: number, err: unknown) => void;
}

/**
 * Extract an HTTP status code from an error if the error carries one.
 * The openai SDK exposes it as `error.status` (number).
 */
function extractStatus(err: unknown): number | undefined {
  if (
    err !== null &&
    typeof err === 'object' &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
  ) {
    return (err as { status: number }).status;
  }
  return undefined;
}

/**
 * Sleep for `ms` milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn`, retrying on the configured status codes with exponential backoff + jitter.
 *
 * Non-retryable status codes (4xx outside `retryOn`) fail immediately.
 * `AbortError` is never retried — it propagates immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const maxDelayMs = opts.maxDelayMs ?? 10_000;
  const retryOnSet = new Set(opts.retryOn);

  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;

      // Never retry AbortError — the caller intentionally cancelled.
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }

      const status = extractStatus(err);

      // 4xx errors outside the retryOn list fail immediately (e.g. 401, 403, 400).
      if (
        status !== undefined &&
        status >= 400 &&
        status < 500 &&
        !retryOnSet.has(status)
      ) {
        throw err;
      }

      // If status is known and NOT in the retry list, fail immediately.
      if (status !== undefined && !retryOnSet.has(status)) {
        throw err;
      }

      // No more attempts left — fall through to the rethrow below.
      if (attempt >= maxAttempts) {
        break;
      }

      opts.onRetry?.(attempt, err);

      // Exponential backoff: delay = min(baseDelay * 2^(attempt-1) + jitter, maxDelay)
      const exponential = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = opts.jitter ? Math.random() * baseDelayMs : 0;
      const delay = Math.min(exponential + jitter, maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastErr;
}

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

/**
 * Simple circuit breaker tracking consecutive failures.
 *
 * - Counts consecutive failures on each `recordFailure()` call.
 * - Opens (`isOpen === true`) after `threshold` consecutive failures.
 * - Resets on `recordSuccess()`.
 *
 * Usage: call `recordFailure()` in catch blocks, `recordSuccess()` on success,
 * and guard each attempt with `if (cb.isOpen) throw new CircuitOpenError()`.
 */
export class CircuitBreaker {
  private consecutiveFailures = 0;
  readonly threshold: number;

  constructor(threshold = 5) {
    this.threshold = threshold;
  }

  get isOpen(): boolean {
    return this.consecutiveFailures >= this.threshold;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  recordFailure(): void {
    this.consecutiveFailures++;
  }

  reset(): void {
    this.consecutiveFailures = 0;
  }
}

export class CircuitOpenError extends Error {
  override readonly name = 'CircuitOpenError';
  constructor() {
    super('Circuit breaker is open — too many consecutive failures');
  }
}
