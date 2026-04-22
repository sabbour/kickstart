/**
 * POST /api/converse — v2 harness converse handler.
 *
 * Loads or creates a Session, runs the Runner, and streams 9 SSE event types:
 *   start | chunk | a2ui | tool_start | tool_done | phase | user_action_req | end | error
 *
 * Leela C4: phase routing is handled via the `end` event's `intent` field which
 * the browser passes to `useNavigation.onIntent()`. This handler does NOT perform
 * direct phase routing.
 */

import { randomUUID } from "node:crypto";
import { app } from "@azure/functions";
import type { HttpRequest, InvocationContext } from "@azure/functions";
import { Logger, extractTraceId, extractRequestMetadata } from "../lib/logger.js";
import { trackException, trackEvent, flushAppInsights, initializeAppInsights } from "../lib/appinsights.js";
import { getRegistry } from "../startup/packs.js";
import { getOrCreateSession } from "@aks-kickstart/harness/runtime/session";
import { Runner } from "@aks-kickstart/harness/runtime/runner";
import { SSE_RESPONSE_HEADERS, formatSSEFrame } from "@aks-kickstart/harness/runtime/sse";
import type { SSEEventType } from "@aks-kickstart/harness/runtime/sse";
import { sanitizeError } from "../telemetry/sanitize-error.js";

interface ConverseRequest {
  sessionId?: string;
  message: string;
  clientMessageId?: string;
}

async function converse(
  request: HttpRequest,
  ctx: InvocationContext,
): Promise<Response> {
  try { initializeAppInsights(); } catch { /* init failure must not kill the request path */ }
  const startTime = Date.now();
  const requestId = randomUUID();
  const traceId = extractTraceId(request.headers);
  const logger = new Logger(ctx, "converse", traceId).withContext({ request_id: requestId });

  const requestMeta = extractRequestMetadata(request);
  logger.info("HTTP request received", requestMeta);

  let body: ConverseRequest;
  try {
    body = await request.json() as ConverseRequest;
  } catch (err) {
    const sanitizedError = sanitizeError(err);
    logger.error("Failed to parse JSON body", sanitizedError);
    trackEvent("converse-parse-error", { requestId });
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.message || typeof body.message !== "string") {
    logger.warn("Invalid request: message field missing or not a string");
    trackEvent("converse-validation-error", { requestId, reason: "missing-message" });
    return new Response(JSON.stringify({ error: "'message' field is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const principalHeader = request.headers.get("x-ms-client-principal");
  let oid = "anonymous";
  if (principalHeader) {
    try {
      const decoded = Buffer.from(principalHeader, "base64").toString("utf-8");
      const principal = JSON.parse(decoded) as {
        userId?: string;
        claims?: Array<{ typ: string; val: string }>;
      };
      const oidClaim = principal.claims?.find(
        (claim) => claim.typ === "http://schemas.microsoft.com/identity/claims/objectidentifier" || claim.typ === "oid",
      );
      oid = oidClaim?.val ?? principal.userId ?? "anonymous";
      logger.info("Principal extracted from SWA header", { oid_found: oid !== "anonymous" });
    } catch (err) {
      logger.warn("Failed to parse SWA principal header", {
        error: sanitizeError(err).message,
      });
    }
  }

  let registry;
  try {
    const registryStartTime = Date.now();
    registry = getRegistry();
    const registryDuration = Date.now() - registryStartTime;
    logger.info("Pack registry initialized", { duration_ms: registryDuration });
    trackEvent("pack-registry-initialized", { requestId, durationMs: String(registryDuration) });
  } catch (err) {
    const sanitizedError = sanitizeError(err);
    logger.error("Pack registry initialization failed", sanitizedError);
    trackException(sanitizedError, { requestId, context: "pack-registry-init" });
    await flushAppInsights();

    const encoder = new TextEncoder();
    const errorFrame = encoder.encode(
      `event: error\ndata: ${JSON.stringify({
        message: "Pack registry initialization failed. Please check server logs for details.",
      })}\n\n`,
    );

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(errorFrame);
          controller.close();
        },
      }),
      {
        status: 200,
        headers: { ...SSE_RESPONSE_HEADERS, "X-Pack-Init-Failed": "true" },
      },
    );
  }

  let session;
  try {
    session = getOrCreateSession(body.sessionId, oid);
    logger.info("Session resolved", { action: body.sessionId ? "resumed" : "created" });
  } catch (err) {
    if (err instanceof Error && err.message === "SESSION_OID_MISMATCH") {
      logger.warn("Session ownership mismatch");
      trackEvent("session-oid-mismatch", { requestId });
      return new Response("Forbidden", { status: 403 });
    }

    const sanitizedError = sanitizeError(err);
    logger.error("Failed to resolve session", sanitizedError);
    trackException(sanitizedError, { requestId, context: "session-resolution" });
    await flushAppInsights();
    throw err;
  }

  const requestLogger = logger.withContext({ request_id: requestId });
  const runner = new Runner(registry);
  const abortController = new AbortController();
  const encoder = new TextEncoder();
  let eventCount = 0;
  let errorCount = 0;
  let firstChunkTime: number | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: SSEEventType, data: unknown) => {
        try {
          if (firstChunkTime === null) {
            firstChunkTime = Date.now() - startTime;
            requestLogger.debug("First SSE chunk emitted", { first_chunk_ms: firstChunkTime });
          }
          eventCount++;
          if (event === "error") {
            errorCount++;
          }
          controller.enqueue(encoder.encode(formatSSEFrame(event, data)));
        } catch {
          // client disconnected
        }
      };

      try {
        requestLogger.info("Starting runner", { message_length: body.message.length });
        const runStartTime = Date.now();
        await runner.run(session, body.message, write, abortController.signal);
        const runDuration = Date.now() - runStartTime;

        requestLogger.info("Runner completed successfully", {
          duration_ms: runDuration,
          event_count: eventCount,
          error_count: errorCount,
        });
        trackEvent("converse-success", {
            requestId,
            durationMs: String(runDuration),
            eventCount: String(eventCount),
            errorCount: String(errorCount),
          });
      } catch (err) {
        errorCount++;
        const sanitizedError = sanitizeError(err);
        requestLogger.error("Runner execution failed", sanitizedError);
        trackException(sanitizedError, { requestId, context: "runner-execution" });
        await flushAppInsights();
        try {
          write("error", { message: sanitizedError.message });
        } catch {
          // ignore write failure on disconnect
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      requestLogger.info("Client disconnected during request");
      trackEvent("converse-client-disconnect", { requestId });
      abortController.abort("client-disconnect");
    },
  });

  requestLogger.info("HTTP response sent", {
    status_code: 200,
    duration_ms: Date.now() - startTime,
    event_count: eventCount,
    first_chunk_ms: firstChunkTime,
    error_count: errorCount,
  });

  return new Response(stream, {
    status: 200,
    headers: SSE_RESPONSE_HEADERS,
  });
}

app.http("converse", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "converse",
  handler: converse,
});
