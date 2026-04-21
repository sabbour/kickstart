import { randomUUID } from "node:crypto";
import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { Logger, extractTraceId, extractRequestMetadata } from "../lib/logger.js";
import { getAppInsightsClient } from "../lib/appinsights.js";
import { getRegistry } from "../startup/packs.js";
import { sanitizeError } from "../telemetry/sanitize-error.js";

interface HealthResponse {
  status: "ok" | "error";
  phase?: string;
  message?: string;
  detail?: string;
  hint?: string;
  registry?: "ready";
}

function diagnoseProblem(err: unknown): { phase: string; hint: string } {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("AZURE_OPENAI") || msg.includes("environment variable")) {
    return {
      phase: "env-validation",
      hint: "Ensure AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT environment variables are set",
    };
  }
  if (msg.includes("cannot find module") || msg.includes("ERR_MODULE_NOT_FOUND")) {
    return {
      phase: "pack-import",
      hint: "One or more pack modules failed to import. Check that all dependencies are installed.",
    };
  }
  if (msg.includes("seal") || msg.includes("Seal")) {
    return {
      phase: "registry-seal",
      hint: "Pack registry failed to seal. Check pack registration logs.",
    };
  }
  return {
    phase: "pack-registry-init",
    hint: "Pack registry initialization failed. Check server logs for details.",
  };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const startTime = Date.now();
    const requestId = randomUUID();
    const traceId = extractTraceId(req.headers);
    const logger = new Logger(ctx, "health", traceId).withContext({ request_id: requestId });
    const appInsights = getAppInsightsClient();

    const requestMeta = extractRequestMetadata(req);
    logger.info("HTTP request received", requestMeta);

    try {
      logger.info("Validating pack registry...");
      getRegistry();
      const duration = Date.now() - startTime;

      logger.info("Pack registry validated", {
        status: "ok",
        duration_ms: duration,
      });
      appInsights.trackEvent({
        name: "health-check-success",
        properties: { requestId, registryInitDurationMs: String(duration) },
      });

      return {
        status: 200,
        jsonBody: { status: "ok", registry: "ready" } as HealthResponse,
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      const sanitizedError = sanitizeError(err);
      const { phase, hint } = diagnoseProblem(err);

      logger.error("Health check failed", sanitizedError, {
        duration_ms: duration,
        phase,
      });
      appInsights.trackException({
        exception: sanitizedError,
        properties: { requestId, context: "health-check-pack-init", phase },
      });

      return {
        status: 503,
        jsonBody: {
          status: "error",
          phase,
          message: "Pack registry initialization failed",
          detail: sanitizedError.message,
          hint,
        } as HealthResponse,
      };
    }
  },
});
