/**
 * @module @kickstart/api/functions/github-oauth
 *
 * POST /api/github-oauth/{*path} — CORS proxy for GitHub OAuth endpoints.
 *
 * Proxies requests to github.com for the OAuth Device Flow and token exchange.
 * Only POST is supported (Device Flow code requests and token exchanges).
 *
 * Typical paths:
 *   /api/github-oauth/login/device/code     — request a device code
 *   /api/github-oauth/login/oauth/access_token — exchange code for token
 */
import { app } from "@azure/functions";
import { isAllowedHost, blockedHostResponse } from "../lib/proxy-allowlist.js";
const GITHUB_BASE = "https://github.com";
/** Only these github.com paths may be proxied. */
const ALLOWED_PATHS = new Set([
    "login/device/code",
    "login/oauth/access_token",
]);
app.http("github-oauth", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "github-oauth/{*path}",
    handler: async (request, context) => {
        const upstreamPath = request.params["path"] ?? "";
        if (!ALLOWED_PATHS.has(upstreamPath)) {
            context.warn(`[github-oauth] blocked path: ${upstreamPath}`);
            return { status: 403, jsonBody: { error: "Path not allowed" } };
        }
        const upstreamUrl = new URL(`${GITHUB_BASE}/${upstreamPath}`);
        request.query.forEach((value, key) => {
            upstreamUrl.searchParams.set(key, value);
        });
        // Host allowlist validation
        if (!isAllowedHost(upstreamUrl, "github-oauth")) {
            context.warn(`[github-oauth] blocked host: ${upstreamUrl.hostname}`);
            return blockedHostResponse(upstreamUrl.hostname);
        }
        const upstreamHeaders = {
            Accept: "application/json",
            "User-Agent": "kickstart-proxy/1.0",
        };
        const contentType = request.headers.get("content-type");
        if (contentType) {
            upstreamHeaders["Content-Type"] = contentType;
        }
        const body = await request.arrayBuffer();
        context.log(`[github-oauth] POST ${upstreamUrl.toString()}`);
        let upstream;
        try {
            upstream = await fetch(upstreamUrl.toString(), {
                method: "POST",
                headers: upstreamHeaders,
                body,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            context.error(`[github-oauth] fetch error: ${message}`);
            return { status: 502, jsonBody: { error: "Upstream unreachable" } };
        }
        const responseHeaders = {
            "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        };
        const responseBody = await upstream.arrayBuffer();
        return {
            status: upstream.status,
            headers: responseHeaders,
            body: responseBody,
        };
    },
});
//# sourceMappingURL=github-oauth.js.map