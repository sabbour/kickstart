/**
 * @module @kickstart/api/functions/pricing-proxy
 *
 * GET /api/pricing-proxy — CORS proxy for Azure Retail Prices API.
 *
 * Forwards query parameters to prices.azure.com/api/retail/prices.
 * No authentication required — the Azure pricing API is public.
 *
 * Typical usage: GET /api/pricing-proxy?$filter=serviceName eq 'Azure Kubernetes Service'
 */
import { app } from "@azure/functions";
import { isAllowedHost, blockedHostResponse } from "../lib/proxy-allowlist.js";
const PRICING_BASE = "https://prices.azure.com/api/retail/prices";
const RATE_LIMIT_HEADERS = [
    "retry-after",
    "x-ms-ratelimit-remaining-subscription-reads",
    "x-ms-request-id",
];
app.http("pricing-proxy", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "pricing-proxy",
    handler: async (request, context) => {
        const upstreamUrl = new URL(PRICING_BASE);
        request.query.forEach((value, key) => {
            upstreamUrl.searchParams.set(key, value);
        });
        // Host allowlist validation
        if (!isAllowedHost(upstreamUrl, "pricing-proxy")) {
            context.warn(`[pricing-proxy] blocked host: ${upstreamUrl.hostname}`);
            return blockedHostResponse(upstreamUrl.hostname);
        }
        context.log(`[pricing-proxy] GET ${upstreamUrl.toString()}`);
        let upstream;
        try {
            upstream = await fetch(upstreamUrl.toString(), {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "User-Agent": "kickstart-proxy/1.0",
                },
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            context.error(`[pricing-proxy] fetch error: ${message}`);
            return { status: 502, jsonBody: { error: `Upstream unreachable: ${message}` } };
        }
        const responseHeaders = {
            "Content-Type": upstream.headers.get("content-type") ?? "application/json",
            "Cache-Control": "public, max-age=300",
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
//# sourceMappingURL=pricing-proxy.js.map