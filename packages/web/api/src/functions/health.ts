import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getRegistry } from "../startup/packs.js";

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (_req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      // Validate that pack registry can be initialized
      const registry = getRegistry();
      ctx.log("[health] Pack registry initialized successfully");
      return {
        status: 200,
        jsonBody: { status: "ok", registry: "ready" },
      };
    } catch (err) {
      ctx.error(`[health] Pack registry initialization failed: ${err instanceof Error ? err.message : String(err)}`);
      if (err instanceof Error && err.stack) {
        ctx.error(`[health] Stack: ${err.stack}`);
      }
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
