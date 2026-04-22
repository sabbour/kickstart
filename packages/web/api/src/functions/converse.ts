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
import { createReadSkillTool } from "../../../../pack-core/src/tools/read_skill.js";
import { SSE_RESPONSE_HEADERS, formatSSEFrame } from "@aks-kickstart/harness/runtime/sse";
import type { SSEEventType } from "@aks-kickstart/harness/runtime/sse";
import { sanitizeError } from "../telemetry/sanitize-error.js";

interface ConverseRequest {
  sessionId?: string;
  message: string;
  clientMessageId?: string;
  /**
   * Structured A2UI event metadata (Layer 1 of #1062). Present when the user
   * message originated from an A2UI component action (e.g. a Button click).
   * The event name + payload are injected into the agent-facing prompt so the
   * triage agent can branch-on-event without parsing free-form bubble text.
   */
  event?: {
    name: string;
    payload?: Record<string, unknown>;
  };
}

/** Maximum byte length for `body.message`. ~8 KB. */
const MESSAGE_MAX_BYTES = 8 * 1024;

/** Allowlist regex for event names — alphanumeric, underscore, colon, hyphen; 1–64 chars. */
const EVENT_NAME_RE = /^[a-zA-Z0-9_:\-]{1,64}$/;

/** Maximum byte length for JSON.stringify(event.payload). ~2 KB. */
const PAYLOAD_MAX_BYTES = 2 * 1024;

/**
 * Validate and coerce `body.event`.
 * Returns the coerced event on success, or a non-null rejection reason string on failure.
 *
 * H1a: reject event names that don't match EVENT_NAME_RE (blocks newline injection).
 * H1b: reject payloads whose serialised form exceeds PAYLOAD_MAX_BYTES.
 * H1c: shape guard — payload must be a plain object (or absent).
 */
function coerceEvent(
  raw: ConverseRequest["event"] | undefined,
): { event: ConverseRequest["event"] } | { rejection: string } {
  if (raw === undefined || raw === null) {
    return { event: undefined };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { rejection: "event must be a plain object" };
  }
  const { name, payload } = raw as { name: unknown; payload?: unknown };
  if (typeof name !== "string" || !EVENT_NAME_RE.test(name)) {
    return { rejection: `event.name invalid: must match ${EVENT_NAME_RE.source}` };
  }
  if (payload !== undefined && payload !== null) {
    if (typeof payload !== "object" || Array.isArray(payload)) {
      return { rejection: "event.payload must be a plain object" };
    }
    let serialised: string;
    try {
      serialised = JSON.stringify(payload);
    } catch {
      return { rejection: "event.payload is not serialisable" };
    }
    if (Buffer.byteLength(serialised, "utf8") > PAYLOAD_MAX_BYTES) {
      return { rejection: `event.payload exceeds ${PAYLOAD_MAX_BYTES} byte limit` };
    }
  }
  return {
    event: {
      name,
      payload: (payload as Record<string, unknown> | undefined) ?? undefined,
    },
  };
}

/**
 * Compose the agent-facing input string from the human-readable message and an
 * optional structured A2UI event. The user bubble always shows `body.message`
 * (the button label); the agent additionally sees a compact, deterministic
 * event marker it can branch on.
 *
 * Kept intentionally tiny and pure so Bender's Layer 0 Runner changes don't
 * need to know about the wire shape.
 */
function composeAgentInput(
  message: string,
  event: ConverseRequest["event"] | undefined,
): string {
  if (!event || typeof event.name !== "string" || event.name.length === 0) {
    return message;
  }
  const payload = event.payload && typeof event.payload === "object"
    ? event.payload
    : {};
  let payloadStr: string;
  try {
    payloadStr = JSON.stringify(payload);
  } catch {
    payloadStr = "{}";
  }
  // Compact single-line marker — triage.agent.md has an explicit
  // branch-on-event rule that matches this exact prefix.
  return `${message}\n\n[A2UI event] name=${event.name} payload=${payloadStr}`;
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

  // M1: cap message size to prevent unbounded LLM token spend.
  if (Buffer.byteLength(body.message, "utf8") > MESSAGE_MAX_BYTES) {
    logger.warn("Rejected oversized message", { byte_length: Buffer.byteLength(body.message, "utf8") });
    trackEvent("converse-validation-error", { requestId, reason: "message-too-large" });
    return new Response(JSON.stringify({ error: "Message too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  // H1a/H1b/H1c: server-side event validation.
  const eventResult = coerceEvent(body.event);
  if ("rejection" in eventResult) {
    logger.warn("Rejected invalid event", { reason: eventResult.rejection });
    trackEvent("converse-validation-error", { requestId, reason: "invalid-event", detail: eventResult.rejection });
    return new Response(JSON.stringify({ error: `Invalid event: ${eventResult.rejection}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const validatedEvent = eventResult.event;

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
  const runner = new Runner(registry, { readSkillToolFactory: createReadSkillTool });
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
        const agentInput = composeAgentInput(body.message, validatedEvent);
        requestLogger.info("Starting runner", {
          message_length: body.message.length,
          agent_input_length: agentInput.length,
          has_event: Boolean(body.event?.name),
        });
        const runStartTime = Date.now();
        await runner.run(session, agentInput, write, abortController.signal);
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
