import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { AzureApiError, azureErrorResponse } from "../lib/azure-errors.js";
import { checkRateLimit, rateLimitResponse } from "../lib/rate-limiter.js";
import {
  adoptSessionPrincipal,
  getPrincipalId,
  getSession,
  isSessionOwnedBy,
} from "../lib/session-store.js";
import { recordCostGate } from "../lib/azure-deployments.js";

app.http("deploy-cost-gate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "sessions/{sessionId}/deploy-gates/cost",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    const rateCheck = checkRateLimit(request);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.retryAfterMs!);
    }

    try {
      const principalId = getPrincipalId(request);
      if (!principalId) {
        throw new AzureApiError(403, "principal_required", "Sign in to Kickstart before acknowledging costs.");
      }

      const sessionId = request.params["sessionId"] ?? "";
      const session = getSession(sessionId);
      if (!session) {
        throw new AzureApiError(404, "session_not_found", `Session "${sessionId}" was not found.`);
      }
      if (!isSessionOwnedBy(session, principalId)) {
        throw new AzureApiError(403, "forbidden_session", "This session belongs to a different user.");
      }

      adoptSessionPrincipal(session, principalId);

      const body = (await request.json()) as {
        estimatedMonthlyTotal?: unknown;
        total?: unknown;
        currency?: unknown;
        source?: unknown;
      };

      const deployState = recordCostGate(session, {
        estimatedMonthlyTotal: typeof body.estimatedMonthlyTotal === "number"
          ? body.estimatedMonthlyTotal
          : typeof body.total === "number"
            ? body.total
            : NaN,
        currency: typeof body.currency === "string" ? body.currency : "USD",
        source: typeof body.source === "string" ? body.source : "unknown",
      });

      return {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
        jsonBody: {
          sessionId: session.state.sessionId,
          deployState,
        },
      };
    } catch (error) {
      return azureErrorResponse(error, context, "[deploy-cost-gate]");
    }
  },
});
