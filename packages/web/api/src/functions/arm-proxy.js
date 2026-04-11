/**
 * @module @kickstart/api/functions/arm-proxy
 *
 * ANY /api/arm-proxy/{*path} — CORS proxy for Azure Resource Manager API.
 *
 * Forwards requests to management.azure.com, passing the caller's
 * Authorization header and all query parameters. Adds a default api-version
 * if the caller omits one.
 */
import { app } from "@azure/functions";
import { isAllowedHost, blockedHostResponse } from "../lib/proxy-allowlist.js";
const ARM_BASE = "https://management.azure.com";
const DEFAULT_API_VERSION = "2024-03-01";
const RATE_LIMIT_HEADERS = [
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
    "retry-after",
    "x-ms-ratelimit-remaining-subscription-reads",
    "x-ms-ratelimit-remaining-subscription-writes",
    "x-ms-request-id",
    "x-ms-correlation-request-id",
];
app.http("arm-proxy", {
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    authLevel: "anonymous",
    route: "arm-proxy/{*path}",
    handler: async (request, context) => {
        const upstreamPath = request.params["path"] ?? "";
        // Build upstream URL, preserving all query parameters
        const upstreamUrl = new URL(`${ARM_BASE}/${upstreamPath}`);
        // Host allowlist validation
        if (!isAllowedHost(upstreamUrl, "arm-proxy")) {
            context.warn(`[arm-proxy] blocked host: ${upstreamUrl.hostname}`);
            return blockedHostResponse(upstreamUrl.hostname);
        }
        request.query.forEach((value, key) => {
            upstreamUrl.searchParams.set(key, value);
        });
        // Inject default api-version if caller omitted it
        if (!upstreamUrl.searchParams.has("api-version")) {
            upstreamUrl.searchParams.set("api-version", DEFAULT_API_VERSION);
        }
        const authHeader = request.headers.get("authorization");
        if (!authHeader) {
            return { status: 401, jsonBody: { error: "Authorization header required" } };
        }
        const upstreamHeaders = {
            Authorization: authHeader,
            "Content-Type": request.headers.get("content-type") ?? "application/json",
            Accept: request.headers.get("accept") ?? "application/json",
        };
        let body;
        if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
            body = await request.arrayBuffer();
        }
        context.log(`[arm-proxy] ${request.method} ${upstreamUrl.toString()}`);
        let upstream;
        try {
            upstream = await fetch(upstreamUrl.toString(), {
                method: request.method,
                headers: upstreamHeaders,
                body,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            context.error(`[arm-proxy] fetch error: ${message}`);
            return { status: 502, jsonBody: { error: `Upstream unreachable: ${message}` } };
        }
        const responseHeaders = {
            "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        };
        for (const header of RATE_LIMIT_HEADERS) {
            const value = upstream.headers.get(header);
            if (value)
                responseHeaders[header] = value;
        }
        const responseBody = await upstream.arrayBuffer();
        return {
            status: upstream.status,
            headers: responseHeaders,
            body: responseBody,
        };
    },
});
//# sourceMappingURL=arm-proxy.js.map