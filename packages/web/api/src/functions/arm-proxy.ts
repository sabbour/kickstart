/**
 * @module @aks-kickstart/api/functions/arm-proxy
 *
 * Tombstone for the retired `/api/arm-proxy/*` route (issue #237 / #321).
 *
 * Browser-direct ARM (Option A2) replaces this proxy: the SPA obtains its
 * AAD token from `/api/azure/token` and calls `https://management.azure.com`
 * directly through `armFetch`. This handler stays registered to return an
 * explicit `410 Gone` so any straggling caller gets a clear migration signal
 * — same pattern used by `github-proxy.ts` and `github-oauth.ts`.
 */
import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";

const GONE_RESPONSE: HttpResponseInit = {
  status: 410,
  jsonBody: {
    error:
      "The /api/arm-proxy route has been retired. Browser ARM calls now go directly to https://management.azure.com using a token from GET /api/azure/token (see armFetch).",
  },
  headers: {
    "Cache-Control": "no-store",
  },
};

app.http("arm-proxy-legacy", {
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
  authLevel: "anonymous",
  route: "arm-proxy/{*path}",
  handler: async (_request: HttpRequest): Promise<HttpResponseInit> => GONE_RESPONSE,
});
