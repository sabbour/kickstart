/**
 * @module @kickstart/api/lib/rate-limiter
 *
 * Simple in-memory per-IP rate limiter for API endpoints.
 * Tracks request counts in a sliding window and rejects requests
 * that exceed the configured limit.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 30;

// Periodically clean up expired entries to prevent unbounded memory growth
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.windowStart > DEFAULT_WINDOW_MS * 2) {
      store.delete(key);
    }
  }
}, 5 * 60_000);
cleanupInterval.unref();

/**
 * Extract the client IP from an Azure Functions HTTP request.
 * Falls back to "unknown" if no IP can be determined.
 */
function getClientIp(request: { headers: { get(name: string): string | undefined | null } }): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-client-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

/**
 * Check whether a request from the given IP is within the rate limit.
 * Returns { allowed, remaining, retryAfterMs }.
 */
export function checkRateLimit(
  request: { headers: { get(name: string): string | undefined | null } },
  maxRequests = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS,
): RateLimitResult {
  const ip = getClientIp(request);
  const now = Date.now();

  let entry = store.get(ip);

  // Start a new window if none exists or the current one has expired
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { count: 0, windowStart: now };
    store.set(ip, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}

/**
 * Build a 429 Too Many Requests response with appropriate headers.
 */
export function rateLimitResponse(retryAfterMs: number): {
  status: 429;
  headers: Record<string, string>;
  jsonBody: { error: string };
} {
  return {
    status: 429,
    headers: {
      "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
    },
    jsonBody: { error: "Too many requests. Please try again later." },
  };
}
