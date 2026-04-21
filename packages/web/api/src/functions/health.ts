import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { Logger, extractTraceId, extractRequestMetadata } from "../lib/logger.js";
import { getRegistry } from "../startup/packs.js";

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

  // Detect common failure causes
  if (msg.includes('AZURE_OPENAI') || msg.includes('environment variable')) {
    return {
      phase: 'env-validation',
      hint: 'Ensure AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT environment variables are set',
    };
  }
  if (msg.includes('cannot find module') || msg.includes('ERR_MODULE_NOT_FOUND')) {
    return {
      phase: 'pack-import',
      hint: 'One or more pack modules failed to import. Check that all dependencies are installed.',
    };
  }
  if (msg.includes('seal') || msg.includes('Seal')) {
    return {
      phase: 'registry-seal',
      hint: 'Pack registry failed to seal. Check pack registration logs.',
    };
  }
  return {
    phase: 'pack-registry-init',
    hint: 'Pack registry initialization failed. Check server logs for details.',
  };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const startTime = Date.now();
    const traceId = extractTraceId(req.headers);
    const logger = new Logger(ctx, "health", traceId);

    const requestMeta = extractRequestMetadata(req);
    logger.info("HTTP request received", requestMeta);

    try {
      logger.info("Validating pack registry...");
      const registry = getRegistry();
      const duration = Date.now() - startTime;

      logger.info("Pack registry validated", {
        status: "ok",
        duration_ms: duration,
      });

      return {
        status: 200,
        jsonBody: { status: "ok", registry: "ready" } as HealthResponse,
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      const { phase, hint } = diagnoseProblem(err);

      logger.error("Health check failed", err as Error, {
        duration_ms: duration,
        phase,
        detail: errorMsg,
      });

      return {
        status: 503,
        jsonBody: {
          status: "error",
          phase,
          message: "Pack registry initialization failed",
          detail: errorMsg,
          hint,
        } as HealthResponse,
      };
    }
  },
});
