import { randomUUID } from "node:crypto";
import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { Logger, extractTraceId, extractRequestMetadata } from "../lib/logger.js";
import { getAppInsightsClient } from "../lib/appinsights.js";
import { getRegistry, getLoadErrors } from "../startup/packs.js";
import type { PackLoadError } from "../startup/packs.js";
import { sanitizeError } from "../telemetry/sanitize-error.js";
import { getChatDeploymentName } from "../lib/openai-client.js";

/** Shape returned for the optional LLM canary check. */
export interface LlmCheckResult {
  ok: boolean;
  latencyMs: number;
  model: string;
  errorCode?: number | string;
  cached?: true;
}

// Leela C2: status union includes "degraded" for partial pack load.
interface HealthResponse {
  status: "ok" | "degraded" | "error";
  phase?: string;
  hint?: string;
  registry?: "ready";
  loadErrors?: PackLoadError[];
  llm?: LlmCheckResult;
}

// ---------------------------------------------------------------------------
// LLM canary — module-level cache (30 s TTL, success-only)
// ---------------------------------------------------------------------------

const LLM_CACHE_TTL_MS = 30_000;
const LLM_TIMEOUT_MS = 8_000;

interface LlmCache {
  result: LlmCheckResult;
  expiresAt: number;
}

let _llmCache: LlmCache | null = null;

/** Exposed for testing. */
export function resetLlmCache(): void {
  _llmCache = null;
}

/**
 * Fire a minimal chat-completions probe against AOAI.
 * Returns a {@link LlmCheckResult} — never throws.
 * On success, writes to the module-level cache for 30 s.
 */
export async function probeLlm(): Promise<LlmCheckResult> {
  const now = Date.now();

  if (_llmCache && now < _llmCache.expiresAt) {
    return { ..._llmCache.result, cached: true };
  }

  const model = getChatDeploymentName();
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/+$/, "");
  const apiKey = process.env.AZURE_OPENAI_API_KEY;

  if (!endpoint || !apiKey || !model || model === "unknown") {
    return { ok: false, latencyMs: 0, model, errorCode: "not-configured" };
  }

  const url = `${endpoint}/openai/deployments/${model}/chat/completions?api-version=2024-12-01-preview`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  const callStart = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hi" }],
        max_completion_tokens: 1,
        stream: false,
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - callStart;

    if (!response.ok) {
      return { ok: false, latencyMs, model, errorCode: response.status };
    }

    const result: LlmCheckResult = { ok: true, latencyMs, model };
    _llmCache = { result, expiresAt: now + LLM_CACHE_TTL_MS };
    return result;
  } catch (err) {
    const latencyMs = Date.now() - callStart;
    const isTimeout =
      err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"));
    return { ok: false, latencyMs, model, errorCode: isTimeout ? "timeout" : "fetch-error" };
  } finally {
    clearTimeout(timer);
  }
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

    const deep = req.query.get("deep") === "1";

    try {
      logger.info("Validating pack registry...");
      getRegistry();
      const loadErrors = getLoadErrors();
      const duration = Date.now() - startTime;
      const degraded = loadErrors.length > 0;

      logger.info("Pack registry validated", {
        status: degraded ? "degraded" : "ok",
        load_errors: loadErrors.length,
        duration_ms: duration,
      });
      appInsights.trackEvent({
        name: "health-check-success",
        properties: {
          requestId,
          registryInitDurationMs: String(duration),
          degraded: String(degraded),
          loadErrorCount: String(loadErrors.length),
        },
      });

      if (!deep) {
        const body: HealthResponse = degraded
          ? { status: "degraded", registry: "ready", loadErrors }
          : { status: "ok", registry: "ready" };
        return { status: 200, jsonBody: body };
      }

      // Deep mode: fire a minimal LLM canary probe.
      logger.info("Deep health check: probing LLM...");
      const llm = await probeLlm();
      logger.info("LLM probe complete", { ok: llm.ok, latencyMs: llm.latencyMs });

      appInsights.trackEvent({
        name: "health-check-llm-probe",
        properties: {
          requestId,
          llmOk: String(llm.ok),
          llmLatencyMs: String(llm.latencyMs),
          llmModel: llm.model,
          ...(llm.errorCode !== undefined ? { llmErrorCode: String(llm.errorCode) } : {}),
        },
      });

      const httpStatus = llm.ok ? 200 : 503;
      const deepBody: HealthResponse = {
        status: degraded ? "degraded" : (llm.ok ? "ok" : "error"),
        registry: "ready",
        llm,
        ...(degraded ? { loadErrors } : {}),
      };
      return { status: httpStatus, jsonBody: deepBody };
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

      // Return only opaque category fields — never raw error messages, file
      // paths, or URLs. Full detail is captured server-side via logger.error
      // and appInsights.trackException above.
      return {
        status: 503,
        jsonBody: { status: "error", phase, hint } as HealthResponse,
      };
    }
  },
});
