/**
 * @module @aks-kickstart/api/functions/azure-token
 *
 * GET /api/azure/token — returns the current user's SWA-injected Azure AD
 * access token so the browser can call ARM (management.azure.com) directly.
 *
 * Issue #237 (PR-1) — replaces the /api/arm-proxy round-trip.
 *
 * Security model (Zapp-approved):
 * - Same-origin only (SWA enforces; no CORS allowed).
 * - HTTPS only (SWA enforces).
 * - Authenticated principal required (`x-ms-client-principal-id`).
 * - Token sourced from `x-ms-token-aad-access-token` — SWA injects this per
 *   request and scopes it to the authenticated session, so a caller can only
 *   ever receive *their own* token. There is no opportunity to harvest
 *   another user's token through this endpoint.
 * - The token value MUST NEVER be logged.
 */

import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { requireAzureAccessToken } from "../lib/azure-auth.js";
import { azureErrorResponse } from "../lib/azure-errors.js";

interface AzureTokenResponse {
  token: string;
  /** Optional ISO timestamp; only set when SWA exposes a hint header. */
  expiresAt?: string;
}

/**
 * Read an optional expiry hint from SWA. SWA may emit
 * `x-ms-token-aad-expires-on` as either an epoch-seconds string or an ISO
 * timestamp; we normalize to ISO. If absent or unparseable, return undefined
 * — the browser will rely on 401-driven refresh.
 */
function readExpiresAt(request: HttpRequest): string | undefined {
  const raw = request.headers.get("x-ms-token-aad-expires-on")?.trim();
  if (!raw) return undefined;

  // Numeric epoch seconds?
  if (/^\d+$/.test(raw)) {
    const ms = Number(raw) * 1000;
    if (Number.isFinite(ms) && ms > 0) {
      return new Date(ms).toISOString();
    }
    return undefined;
  }

  // ISO-ish string — let Date parse it.
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }
  return undefined;
}

app.http("azure-token", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "azure/token",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    try {
      const token = requireAzureAccessToken(request);
      const expiresAt = readExpiresAt(request);

      const body: AzureTokenResponse = expiresAt ? { token, expiresAt } : { token };

      return {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        jsonBody: body,
      };
    } catch (error) {
      // azureErrorResponse only logs sanitized AzureApiError fields (status,
      // code, message, details) — it never sees the token, which is read
      // inside requireAzureAccessToken and either returned or discarded.
      return azureErrorResponse(error, context, "[azure-token]");
    }
  },
});
