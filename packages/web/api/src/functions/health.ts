import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { Logger, extractTraceId, extractRequestMetadata } from "../lib/logger.js";
import { getRegistry } from "../startup/packs.js";

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
        jsonBody: { 
          status: "ok", 
          registry: "ready",
        },
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      logger.error("Health check failed", err as Error, {
        duration_ms: duration,
      });

      return {
        status: 503,
        jsonBody: {
          status: "error",
          message: "Pack registry initialization failed",
          detail: err instanceof Error ? err.message : String(err),
        },
      };
    }
  },
});
