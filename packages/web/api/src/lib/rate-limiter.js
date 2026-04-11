/**
 * @module @kickstart/api/lib/rate-limiter
 *
 * In-memory sliding-window rate limiter for API endpoints.
 *
 * Key resolution order:
 *   1. SWA authenticated principal ID (x-ms-client-principal-id) — trusted
 *   2. IP from proxy headers (x-forwarded-for, x-client-ip, x-real-ip) — fallback
 *   3. Global backstop bucket — always enforced regardless of per-client key
 */
const store = new Map();
const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 30;
// Global backstop: shared bucket for all requests (prevents aggregate abuse)
const GLOBAL_KEY = "__global__";
const GLOBAL_MAX_REQUESTS = 300;
const GLOBAL_WINDOW_MS = 60_000;
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
 * Extract a client identifier from the request.
 * Prefers SWA authenticated principal ID (trusted, not spoofable),
 * falls back to IP-based headers only when auth is unavailable.
 */
function getClientId(request) {
    // SWA injects x-ms-client-principal-id after auth — trusted, not spoofable
    const principalId = request.headers.get("x-ms-client-principal-id");
    if (principalId)
        return `principal:${principalId}`;
    // Fallback to IP headers (spoofable, but better than nothing)
    return `ip:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-client-ip") ||
        request.headers.get("x-real-ip") ||
        "unknown"}`;
}
/** Check a single bucket. Returns { allowed, remaining, retryAfterMs }. */
function checkBucket(key, maxRequests, windowMs) {
    const now = Date.now();
    let entry = store.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
        entry = { count: 0, windowStart: now };
        store.set(key, entry);
    }
    entry.count++;
    if (entry.count > maxRequests) {
        const retryAfterMs = windowMs - (now - entry.windowStart);
        return { allowed: false, remaining: 0, retryAfterMs };
    }
    return { allowed: true, remaining: maxRequests - entry.count };
}
/**
 * Check whether a request is within rate limits.
 * Enforces both a per-client limit and a global backstop.
 */
export function checkRateLimit(request, maxRequests = DEFAULT_MAX_REQUESTS, windowMs = DEFAULT_WINDOW_MS) {
    // Global backstop — always checked regardless of per-client key
    const globalResult = checkBucket(GLOBAL_KEY, GLOBAL_MAX_REQUESTS, GLOBAL_WINDOW_MS);
    if (!globalResult.allowed)
        return globalResult;
    // Per-client limit
    const clientId = getClientId(request);
    return checkBucket(clientId, maxRequests, windowMs);
}
/**
 * Build a 429 Too Many Requests response with appropriate headers.
 */
export function rateLimitResponse(retryAfterMs) {
    return {
        status: 429,
        headers: {
            "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        },
        jsonBody: { error: "Too many requests. Please try again later." },
    };
}
//# sourceMappingURL=rate-limiter.js.map