/**
 * @module @aks-kickstart/api/functions/azure-subscriptions
 *
 * GET /api/azure/subscriptions
 *
 * Returns the list of Azure subscriptions visible to the signed-in user.
 * Calls ARM directly from the server side using the SWA-injected AAD access
 * token, so the browser never needs a raw ARM credential for read-only listing.
 */
import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { requireAzureAccessToken } from "../lib/azure-auth.js";
import { armGetList } from "../lib/arm-client.js";
import { azureErrorResponse } from "../lib/azure-errors.js";
import { checkRateLimit, rateLimitResponse } from "../lib/rate-limiter.js";

app.http("azure-subscriptions", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "azure/subscriptions",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    const rateCheck = checkRateLimit(request);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.retryAfterMs!);
    }

    try {
      const accessToken = requireAzureAccessToken(request);
      const value = await armGetList(
        accessToken,
        "/subscriptions?api-version=2022-12-01",
      );

      return {
        status: 200,
        headers: { "Cache-Control": "no-store" },
        jsonBody: { value },
      };
    } catch (error) {
      return azureErrorResponse(error, context, "[azure-subscriptions]");
    }
  },
});
