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
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs?: number;
}
/**
 * Check whether a request is within rate limits.
 * Enforces both a per-client limit and a global backstop.
 */
export declare function checkRateLimit(request: {
    headers: {
        get(name: string): string | undefined | null;
    };
}, maxRequests?: number, windowMs?: number): RateLimitResult;
/**
 * Build a 429 Too Many Requests response with appropriate headers.
 */
export declare function rateLimitResponse(retryAfterMs: number): {
    status: 429;
    headers: Record<string, string>;
    jsonBody: {
        error: string;
    };
};
//# sourceMappingURL=rate-limiter.d.ts.map