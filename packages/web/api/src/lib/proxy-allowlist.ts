/**
 * @module @aks-kickstart/api/lib/proxy-allowlist
 *
 * Host allowlist validation for CORS proxy endpoints.
 *
 * Every proxy route validates the upstream target hostname against a static
 * allowlist before forwarding. This prevents open-redirect / SSRF attacks
 * where a crafted request tricks the proxy into calling arbitrary hosts.
 */

/** Allowed upstream hosts grouped by proxy route. */
export const ALLOWED_HOSTS: Record<string, readonly string[]> = {
  "github-proxy": ["api.github.com"],
  "github-oauth": ["github.com"],
  "pricing-proxy": ["prices.azure.com"],
} as const;

/**
 * Validate that a URL's hostname is on the allowlist for the given proxy.
 *
 * @returns `true` if the host is allowed, `false` otherwise.
 */
export function isAllowedHost(
  upstreamUrl: URL,
  proxyName: keyof typeof ALLOWED_HOSTS,
): boolean {
  const hosts = ALLOWED_HOSTS[proxyName];
  if (!hosts) return false;
  return hosts.includes(upstreamUrl.hostname);
}

/**
 * Build a 403 response for blocked upstream hosts.
 */
export function blockedHostResponse(hostname: string): {
  status: 403;
  jsonBody: { error: string };
} {
  return {
    status: 403,
    jsonBody: { error: `Upstream host not allowed: ${hostname}` },
  };
}
