import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  getAzureDeploymentStatus,
  startAzureDeployment,
} from "../lib/azure-deployments.js";
import { AzureApiError, azureErrorResponse } from "../lib/azure-errors.js";
import { checkRateLimit, rateLimitResponse } from "../lib/rate-limiter.js";
import {
  adoptSessionPrincipal,
  getPrincipalId,
  getSession,
  isSessionOwnedBy,
} from "../lib/session-store.js";

const DEPLOY_START_RATE_LIMIT = { maxRequests: 5, windowMs: 60_000 };
const DEPLOY_POLL_RATE_LIMIT = { maxRequests: 60, windowMs: 60_000 };

function requireBearerToken(request: HttpRequest): string {
  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    throw new AzureApiError(
      401,
      "azure_bearer_token_required",
      "A real Azure access token is required for deployment operations.",
    );
  }

  return authHeader.slice("Bearer ".length).trim();
}

app.http("azure-deployments-start", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "sessions/{sessionId}/azure-deployments",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    const rateCheck = checkRateLimit(
      request,
      DEPLOY_START_RATE_LIMIT.maxRequests,
      DEPLOY_START_RATE_LIMIT.windowMs,
    );
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.retryAfterMs!);
    }

    try {
      const principalId = getPrincipalId(request);
      if (!principalId) {
        throw new AzureApiError(403, "principal_required", "Sign in to Kickstart before deploying to Azure.");
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
        deploymentName?: unknown;
        mainFile?: unknown;
        files?: unknown;
        parameters?: unknown;
        appUrlOutput?: unknown;
        healthCheckPath?: unknown;
      };

      const result = await startAzureDeployment(accessToken, principalId, session, {
        deploymentName: typeof body.deploymentName === "string" ? body.deploymentName : undefined,
        mainFile: typeof body.mainFile === "string" ? body.mainFile : "",
        files: Array.isArray(body.files) ? body.files as Array<{ path: string; content: string }> : [],
        parameters: body.parameters && typeof body.parameters === "object" && !Array.isArray(body.parameters)
          ? body.parameters as Record<string, unknown>
          : undefined,
        appUrlOutput: typeof body.appUrlOutput === "string" ? body.appUrlOutput : undefined,
        healthCheckPath: typeof body.healthCheckPath === "string" ? body.healthCheckPath : undefined,
      });

      return {
        status: 202,
        headers: {
          "Cache-Control": "no-store",
        },
        jsonBody: result,
      };
    } catch (error) {
      return azureErrorResponse(error, context, "[azure-deployments-start]");
    }
  },
});

app.http("azure-deployments-status", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "azure-deployments/{runId}",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    const rateCheck = checkRateLimit(
      request,
      DEPLOY_POLL_RATE_LIMIT.maxRequests,
      DEPLOY_POLL_RATE_LIMIT.windowMs,
    );
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.retryAfterMs!);
    }

    try {
      const principalId = getPrincipalId(request);
      if (!principalId) {
        throw new AzureApiError(403, "principal_required", "Sign in to Kickstart before checking deployment progress.");
      }

      const accessToken = requireBearerToken(request);
      const runId = request.params["runId"] ?? "";
      const result = await getAzureDeploymentStatus(accessToken, principalId, runId);
      return {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
        jsonBody: result,
      };
    } catch (error) {
      return azureErrorResponse(error, context, "[azure-deployments-status]");
    }
  },
});
