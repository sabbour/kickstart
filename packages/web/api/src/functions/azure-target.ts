import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { persistAzureTarget } from "../lib/azure-deployments.js";
import { AzureApiError, azureErrorResponse } from "../lib/azure-errors.js";
import { checkRateLimit, rateLimitResponse } from "../lib/rate-limiter.js";
import {
  adoptSessionPrincipal,
  getPrincipalId,
  getSession,
  isSessionOwnedBy,
} from "../lib/session-store.js";

function requireBearerToken(request: HttpRequest): string {
  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    throw new AzureApiError(
      401,
      "azure_bearer_token_required",
      "A real Azure access token is required for target selection.",
    );
  }

  return authHeader.slice("Bearer ".length).trim();
}

app.http("azure-target", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "sessions/{sessionId}/azure-target",
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
        throw new AzureApiError(403, "principal_required", "Sign in to Kickstart before selecting Azure resources.");
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

      const accessToken = requireBearerToken(request);
      const body = (await request.json()) as {
        subscriptionId?: unknown;
        resourceGroup?: unknown;
        location?: unknown;
        createIfMissing?: unknown;
      };

      const result = await persistAzureTarget(accessToken, session, {
        subscriptionId: typeof body.subscriptionId === "string" ? body.subscriptionId : "",
        resourceGroup: typeof body.resourceGroup === "string" ? body.resourceGroup : "",
        location: typeof body.location === "string" ? body.location : "",
        createIfMissing: body.createIfMissing === true,
      });

      return {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
        jsonBody: {
          sessionId: session.state.sessionId,
          azureContext: result.azureContext,
          deployState: result.deployState,
        },
      };
    } catch (error) {
      return azureErrorResponse(error, context, "[azure-target]");
    }
  },
});
