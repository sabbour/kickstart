/**
 * @module @kickstart/api/lib/proxy-allowlist
 *
 * Host allowlist validation for CORS proxy endpoints.
 *
 * Every proxy route validates the upstream target hostname against a static
 * allowlist before forwarding. This prevents open-redirect / SSRF attacks
 * where a crafted request tricks the proxy into calling arbitrary hosts.
 */
/** Allowed upstream hosts grouped by proxy route. */
export declare const ALLOWED_HOSTS: Record<string, readonly string[]>;
/**
 * Validate that a URL's hostname is on the allowlist for the given proxy.
 *
 * @returns `true` if the host is allowed, `false` otherwise.
 */
export declare function isAllowedHost(upstreamUrl: URL, proxyName: keyof typeof ALLOWED_HOSTS): boolean;
/**
 * Build a 403 response for blocked upstream hosts.
 */
export declare function blockedHostResponse(hostname: string): {
    status: 403;
    jsonBody: {
        error: string;
    };
};
//# sourceMappingURL=proxy-allowlist.d.ts.map