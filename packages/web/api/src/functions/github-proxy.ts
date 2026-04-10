/**
 * @module @kickstart/api/functions/github-proxy
 *
 * ANY /api/github-proxy/{*path} — CORS proxy for GitHub REST API.
 *
 * Forwards requests to api.github.com, injecting the GitHub API Accept
 * header and passing through the caller's Authorization token.
 */

import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { isAllowedHost, blockedHostResponse } from "../lib/proxy-allowlist.js";

const GITHUB_BASE = "https://api.github.com";

const RATE_LIMIT_HEADERS = [
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "x-ratelimit-used",
  "x-ratelimit-resource",
  "retry-after",
  "x-github-request-id",
];

app.http("github-proxy", {
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
  authLevel: "anonymous",
  route: "github-proxy/{*path}",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    const upstreamPath = request.params["path"] ?? "";

    const upstreamUrl = new URL(`${GITHUB_BASE}/${upstreamPath}`);
    request.query.forEach((value, key) => {
      upstreamUrl.searchParams.set(key, value);
    });

    // Host allowlist validation
    if (!isAllowedHost(upstreamUrl, "github-proxy")) {
      context.warn(`[github-proxy] blocked host: ${upstreamUrl.hostname}`);
      return blockedHostResponse(upstreamUrl.hostname);
    }

    const upstreamHeaders: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "kickstart-proxy/1.0",
    };

    const authHeader = request.headers.get("authorization");
    if (authHeader) {
      upstreamHeaders["Authorization"] = authHeader;
    }

    const contentType = request.headers.get("content-type");
    if (contentType) {
      upstreamHeaders["Content-Type"] = contentType;
    }

    let body: BodyInit | undefined;
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      body = await request.arrayBuffer();
    }

    context.log(`[github-proxy] ${request.method} ${upstreamUrl.toString()}`);

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl.toString(), {
        method: request.method,
        headers: upstreamHeaders,
        body,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      context.error(`[github-proxy] fetch error: ${message}`);
      return { status: 502, jsonBody: { error: `Upstream unreachable: ${message}` } };
    }

    const responseHeaders: Record<string, string> = {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    };
    for (const header of RATE_LIMIT_HEADERS) {
      const value = upstream.headers.get(header);
      if (value) responseHeaders[header] = value;
    }

    const responseBody = await upstream.arrayBuffer();
    return {
      status: upstream.status,
      headers: responseHeaders,
      body: responseBody,
    };
  },
});
