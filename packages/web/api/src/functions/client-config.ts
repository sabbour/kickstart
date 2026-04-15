import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPublicApplicationInsightsConfig } from "../lib/observability.js";
import { safeErrorResponse } from "../lib/error-response.js";

app.http("client-config", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "client-config",
  handler: async (_request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      return {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
        jsonBody: {
          applicationInsights: getPublicApplicationInsightsConfig(),
        },
      };
    } catch (error) {
      return safeErrorResponse(error, context, "client-config failed");
    }
  },
});
