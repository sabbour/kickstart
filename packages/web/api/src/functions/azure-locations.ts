/**
 * @module @aks-kickstart/api/functions/azure-locations
 *
 * GET /api/azure/subscriptions/{subId}/locations
 *
 * Returns the list of Azure locations available in the given subscription.
 */
import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { requireAzureAccessToken } from "../lib/azure-auth.js";
import { armGetList } from "../lib/arm-client.js";
import { AzureApiError, azureErrorResponse } from "../lib/azure-errors.js";
import { checkRateLimit, rateLimitResponse } from "../lib/rate-limiter.js";

app.http("azure-locations", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "azure/subscriptions/{subId}/locations",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    const rateCheck = checkRateLimit(request);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.retryAfterMs!);
    }

    try {
      const subId = request.params["subId"]?.trim();
      if (!subId) {
        throw new AzureApiError(400, "missing_subscription_id", "Subscription ID is required.");
      }

      const accessToken = requireAzureAccessToken(request);
      const value = await armGetList(
        accessToken,
        `/subscriptions/${encodeURIComponent(subId)}/locations?api-version=2022-12-01`,
      );

      return {
        status: 200,
        headers: { "Cache-Control": "no-store" },
        jsonBody: { value },
      };
    } catch (error) {
      return azureErrorResponse(error, context, "[azure-locations]");
    }
  },
});
