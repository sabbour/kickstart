/**
 * @module @kickstart/core/connectors/github-rate-limit
 *
 * Tracks GitHub API rate-limit state from response headers and provides
 * pre-flight guards that tools call before issuing requests.
 *
 * GitHub sends these headers on every authenticated response:
 *   X-RateLimit-Limit      — total quota for the current window
 *   X-RateLimit-Remaining  — requests left in the current window
 *   X-RateLimit-Reset      — Unix epoch seconds when the window resets
 */

/** Warn when remaining requests drop below this threshold. */
const WARN_THRESHOLD = 50;

export interface RateLimitState {
  /** Total requests allowed per window. */
  limit: number;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Unix epoch seconds when the window resets. */
  resetAt: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  /** Present when remaining is low or exhausted. */
  warning?: string;
  state: RateLimitState | null;
}

/**
 * Singleton rate-limit tracker for the GitHub connector.
 *
 * Usage:
 *   1. After every GitHub API response, call `update(response)`.
 *   2. Before issuing a new request, call `check()`.
 *      If `allowed` is false the caller must abort.
 */
class GitHubRateLimitTracker {
  private _state: RateLimitState | null = null;

  /** Update internal state from GitHub response headers. */
  update(response: Response): void {
    const limit = response.headers.get("X-RateLimit-Limit");
    const remaining = response.headers.get("X-RateLimit-Remaining");
    const reset = response.headers.get("X-RateLimit-Reset");

    if (remaining === null) return; // Not a rate-limited endpoint

    this._state = {
      limit: parseInt(limit ?? "5000", 10),
      remaining: parseInt(remaining, 10),
      resetAt: parseInt(reset ?? "0", 10),
    };
  }

  /**
   * Pre-flight check. Returns `allowed: false` when the quota is exhausted
   * and the reset window hasn't passed yet.
   */
  check(): RateLimitCheckResult {
    if (!this._state) {
      return { allowed: true, state: null };
    }

    const now = Math.floor(Date.now() / 1000);

    // If the reset window has passed, optimistically allow
    if (now >= this._state.resetAt) {
      return { allowed: true, state: this._state };
    }

    if (this._state.remaining <= 0) {
      const waitSec = this._state.resetAt - now;
      return {
        allowed: false,
        warning: `GitHub API rate limit exhausted. Resets in ${waitSec}s. Request blocked.`,
        state: this._state,
      };
    }

    if (this._state.remaining <= WARN_THRESHOLD) {
      return {
        allowed: true,
        warning: `GitHub API rate limit low: ${this._state.remaining}/${this._state.limit} remaining.`,
        state: this._state,
      };
    }

    return { allowed: true, state: this._state };
  }

  /** Current snapshot (for diagnostics / logging). */
  get state(): Readonly<RateLimitState> | null {
    return this._state;
  }

  /** Reset internal state (useful for tests). */
  reset(): void {
    this._state = null;
  }
}

/** Singleton instance shared by all GitHub tools. */
export const gitHubRateLimiter = new GitHubRateLimitTracker();
