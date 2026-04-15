import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { loadAzureAuthConfig } from "../lib/azure-auth.js";
import { azureErrorResponse } from "../lib/azure-errors.js";
import { checkRateLimit, rateLimitResponse } from "../lib/rate-limiter.js";
import { getPrincipalId } from "../lib/session-store.js";

app.http("azure-auth-config", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "azure-auth/config",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    const rateCheck = checkRateLimit(request);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.retryAfterMs!);
    }

    try {
      if (!getPrincipalId(request)) {
        return {
          status: 403,
          jsonBody: {
            error: "Sign in to Kickstart before checking Azure deployment availability.",
          },
        };
      }

      return {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
        jsonBody: loadAzureAuthConfig(request),
      };
    } catch (error) {
      return azureErrorResponse(error, context, "[azure-auth-config]");
    }
  },
});
