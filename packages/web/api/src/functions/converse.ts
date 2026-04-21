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

import { app } from "@azure/functions";
import type { HttpRequest, InvocationContext } from "@azure/functions";
import { Logger, extractTraceId, extractRequestMetadata } from "../lib/logger.js";
import { getRegistry } from "../startup/packs.js";
import { getOrCreateSession } from "@kickstart/harness/runtime/session";
import { Runner } from "@kickstart/harness/runtime/runner";
import { SSE_RESPONSE_HEADERS, formatSSEFrame } from "@kickstart/harness/runtime/sse";
import type { SSEEventType } from "@kickstart/harness/runtime/sse";

interface ConverseRequest {
  sessionId?: string;
  message: string;
  clientMessageId?: string;
}

async function converse(
  request: HttpRequest,
  ctx: InvocationContext,
): Promise<Response> {
  const startTime = Date.now();
  const traceId = extractTraceId(request.headers);
  const logger = new Logger(ctx, "converse", traceId);

  const requestMeta = extractRequestMetadata(request);
  logger.info("HTTP request received", requestMeta);

  let body: ConverseRequest;
  try {
    body = await request.json() as ConverseRequest;
  } catch (err) {
    logger.error("Failed to parse JSON body", err as Error);
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.message || typeof body.message !== "string") {
    logger.warn("Invalid request: message field missing or not a string");
    return new Response(JSON.stringify({ error: "'message' field is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Extract OID from Azure SWA principal header (may be undefined in dev/anon mode)
  const principalHeader = request.headers.get("x-ms-client-principal");
  let oid = "anonymous";
  if (principalHeader) {
    try {
      const decoded = Buffer.from(principalHeader, "base64").toString("utf-8");
      const principal = JSON.parse(decoded) as { userId?: string; claims?: Array<{ typ: string; val: string }> };
      const oidClaim = principal.claims?.find(
        (c) => c.typ === "http://schemas.microsoft.com/identity/claims/objectidentifier" || c.typ === "oid"
      );
      oid = oidClaim?.val ?? principal.userId ?? "anonymous";
      logger.info("Principal extracted from SWA header", { oid_found: oid !== "anonymous" });
    } catch (err) {
      logger.warn("Failed to parse SWA principal header", err as Error);
    }
  }

  let registry;
  try {
    registry = getRegistry();
  } catch (err) {
    logger.error("Pack registry initialization failed", err as Error);
    const encoder = new TextEncoder();
    const errorFrame = encoder.encode(
      `event: error\ndata: ${JSON.stringify({
        message: "Pack registry initialization failed. Please check server logs for details.",
      })}\n\n`
    );
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(errorFrame);
        controller.close();
      },
    }), {
      status: 200,
      headers: { ...SSE_RESPONSE_HEADERS, "X-Pack-Init-Failed": "true" },
    });
  }

  let session;
  let sessionId: string;
  try {
    session = getOrCreateSession(body.sessionId, oid);
    sessionId = session.id;
    const action = body.sessionId ? "resumed" : "created";
    logger.info("Session resolved", { session_id: sessionId, action });
  } catch (err) {
    logger.error("Failed to resolve session", err as Error, { session_id: body.sessionId });
    if (err instanceof Error && err.message === 'SESSION_OID_MISMATCH') {
      return new Response('Forbidden', { status: 403 });
    }
    throw err;
  }

  const childLogger = logger.withContext(sessionId);
  const runner = new Runner(registry);

  // B2: AbortController to signal runner when client disconnects
  const abortController = new AbortController();

  // Build SSE ReadableStream
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
            childLogger.debug("First SSE chunk emitted", { first_chunk_ms: firstChunkTime });
          }
          eventCount++;
          if (event === "error") {
            errorCount++;
          }
          controller.enqueue(encoder.encode(formatSSEFrame(event, data)));
        } catch { /* client disconnected */ }
      };

      try {
        childLogger.info("Starting runner", { message_length: body.message.length });
        await runner.run(session, body.message, write, abortController.signal);
        childLogger.info("Runner completed successfully", { event_count: eventCount, error_count: errorCount });
      } catch (err) {
        errorCount++;
        childLogger.error("Runner execution failed", err as Error);
        try {
          write("error", { message: err instanceof Error ? err.message : String(err) });
        } catch { /* ignore */ }
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      // B2: client disconnected — abort the runner
      childLogger.info("Client disconnected during request");
      abortController.abort('client-disconnect');
    },
  });

  const responseTime = Date.now() - startTime;
  childLogger.info("HTTP response sent", {
    status_code: 200,
    duration_ms: responseTime,
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
