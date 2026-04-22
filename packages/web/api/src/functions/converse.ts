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
import { z } from "zod";
import { Logger, extractTraceId, extractRequestMetadata } from "../lib/logger.js";
import { trackException, trackEvent, flushAppInsights, initializeAppInsights } from "../lib/appinsights.js";
import { getRegistry } from "../startup/packs.js";
import {
  getOrCreateSession,
  hydrateColdSession,
  isHistoryHydrationEnabled,
  isAnonHydrationAllowed,
  sessionStore,
  HYDRATION_DEFAULT_CAP,
  HYDRATION_CONTENT_MAX_BYTES,
} from "@aks-kickstart/harness/runtime/session";
import type { ClientHydrationMessage } from "@aks-kickstart/harness/runtime/session";
import { Runner } from "@aks-kickstart/harness/runtime/runner";
import { SSE_RESPONSE_HEADERS, formatSSEFrame } from "@aks-kickstart/harness/runtime/sse";
import type { SSEEventType } from "@aks-kickstart/harness/runtime/sse";
import { runGuardrails } from "@aks-kickstart/harness/runtime/guardrails";
import { sanitizeText } from "@aks-kickstart/harness/runtime/redact";
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
  /**
   * Client-supplied prior-turn history for cold-session hydration (#1074 D3).
   * Only hydrated when the resolved session is brand-new AND the feature
   * flag `HARNESS_SESSION_HISTORY_ENABLED` is on. Schema-validated via a
   * strict zod `discriminatedUnion` (Zapp M1); no silent role dropping.
   */
  messages?: ClientHydrationMessage[];
}

/** Maximum byte length for `body.message`. ~8 KB. */
const MESSAGE_MAX_BYTES = 8 * 1024;

/**
 * Pre-parse `Content-Length` cap (Zapp L1).
 *
 * `request.json()` otherwise buffers the entire body before zod can reject it.
 * 256 KB gives ~3x headroom over the 80 KB hydration ceiling (20 × 4 KB) plus
 * other fields + UTF-8 expansion, and is well under any legitimate request.
 */
const REQUEST_MAX_BYTES = 256 * 1024;

/** Allowlist regex for event names — alphanumeric, underscore, colon, hyphen; 1–64 chars. */
const EVENT_NAME_RE = /^[a-zA-Z0-9_:\-]{1,64}$/;

/** Maximum byte length for JSON.stringify(event.payload). ~2 KB. */
const PAYLOAD_MAX_BYTES = 2 * 1024;

// ---------------------------------------------------------------------------
// Zod schema for `messages[]` — Zapp M1 (strict discriminatedUnion)
// ---------------------------------------------------------------------------

/**
 * Strict zod `discriminatedUnion` for a single hydration message. `.strict()`
 * on each branch rejects extra fields (e.g. `toolCallId`, `trust: 'server'`,
 * `role_injection`) so future field-smuggling fails closed at the boundary.
 *
 * `content` is constrained in characters (z.string().max) but the byte-level
 * {@link HYDRATION_CONTENT_MAX_BYTES} cap is enforced below after parse, since
 * UTF-8 multi-byte characters can make a 4096-char string exceed 4 KB.
 */
const ClientHydrationMessageSchema = z.discriminatedUnion("role", [
  z
    .object({
      role: z.literal("user"),
      content: z.string().min(1).max(HYDRATION_CONTENT_MAX_BYTES),
    })
    .strict(),
  z
    .object({
      role: z.literal("assistant"),
      content: z.string().min(1).max(HYDRATION_CONTENT_MAX_BYTES),
    })
    .strict(),
]);

const MessagesArraySchema = z.array(ClientHydrationMessageSchema).max(HYDRATION_DEFAULT_CAP);

/**
 * Telemetry reason codes for `session-hydration-rejected` events (Zapp L2).
 * Count-only — never log the offending content or a substring of it.
 */
type HydrationRejectReason =
  | "invalid-schema"
  | "array-too-large"
  | "content-too-large"
  | "blocked-by-guardrail"
  | "anon-hydration-forbidden";

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

  // L1 (Zapp): pre-parse Content-Length cap — reject before request.json()
  // buffers the body. Defense-in-depth against a caller shipping megabytes of
  // JSON that would be rejected by zod anyway but only after allocation.
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const cl = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(cl) && cl > REQUEST_MAX_BYTES) {
      logger.warn("Rejected oversized request (content-length)", { content_length: cl });
      trackEvent("converse-validation-error", { requestId, reason: "request-too-large" });
      return new Response(JSON.stringify({ error: "Request too large" }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

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

  // #1074 M1 (Zapp): strict schema validation of `messages[]` when present.
  // Uses zod discriminatedUnion + .strict() so unknown roles and extra fields
  // are rejected at the boundary — no filter-then-drop footguns.
  let validatedMessages: ClientHydrationMessage[] | undefined;
  if (body.messages !== undefined) {
    const parsed = MessagesArraySchema.safeParse(body.messages);
    if (!parsed.success) {
      // Distinguish array-too-large (cap+1) from content/schema issues so ops
      // can triage via reason code without echoing payload (Zapp L2).
      const issues = parsed.error.issues;
      const tooMany = issues.some((i) => i.code === "too_big" && i.path.length === 0);
      const reason: HydrationRejectReason = tooMany ? "array-too-large" : "invalid-schema";
      logger.warn("Rejected invalid messages[]", { reason, issue_count: issues.length });
      trackEvent("session-hydration-rejected", { requestId, reason });
      return new Response(
        JSON.stringify({
          error: "Invalid messages",
          code: reason === "array-too-large" ? "HYDRATION_ARRAY_TOO_LARGE" : "HYDRATION_INVALID_SCHEMA",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    // Enforce the per-turn byte ceiling (Zapp M1 — zod `.max()` is in chars).
    for (const m of parsed.data) {
      if (Buffer.byteLength(m.content, "utf8") > HYDRATION_CONTENT_MAX_BYTES) {
        logger.warn("Rejected oversized hydration content", {
          byte_length: Buffer.byteLength(m.content, "utf8"),
        });
        trackEvent("session-hydration-rejected", { requestId, reason: "content-too-large" });
        return new Response(
          JSON.stringify({ error: "Invalid messages", code: "HYDRATION_CONTENT_TOO_LARGE" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }
    validatedMessages = parsed.data;
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

  // #1074 D3: cold-session hydration from client-supplied history.
  //
  // Order of operations (deliberate, per Zapp M1–M4):
  //   1. Feature flag gate (same flag as #1071 read-path — Leela DP note 2).
  //   2. Brand-new detection (recentTurns.length === 0) — warm sessions
  //      ignore client messages silently with a typed log event.
  //   3. Anon interlock (M4): anonymous oid requires HARNESS_ALLOW_ANON_HYDRATION
  //      to be explicitly on; otherwise reject 403. Prevents #1079 amplification.
  //   4. PII/credential scrub (sanitizeText) before content reaches guardrails
  //      or the LLM (Nibbler condition 8).
  //   5. Per-user-turn input guardrails (M2) — fail-closed, reject whole
  //      hydration on any block.
  //   6. hydrateColdSession stamps each turn `trust: 'client-hydrated'` (M3).
  if (validatedMessages !== undefined) {
    if (!isHistoryHydrationEnabled()) {
      logger.info("session-hydration-disabled", {
        session_id: session.sessionId,
        turn_count: validatedMessages.length,
      });
      trackEvent("session-hydration-disabled", {
        requestId,
        turnCount: String(validatedMessages.length),
      });
    } else if (session.recentTurns.length > 0) {
      // Warm session: server is source of truth. Nibbler condition 3 — emit
      // a named, asserted log event so observability contracts are stable.
      logger.info("session-hydration-ignored", {
        session_id: session.sessionId,
        reason: "warm",
        turn_count: validatedMessages.length,
      });
      trackEvent("session-hydration-ignored", {
        requestId,
        reason: "warm",
        turnCount: String(validatedMessages.length),
      });
    } else if (oid === "anonymous" && !isAnonHydrationAllowed()) {
      // M4 anon interlock — reject 403 (default stance per DP). Operators
      // opt in via `HARNESS_ALLOW_ANON_HYDRATION=true` once #1079 is closed
      // or the interlock is canary-validated.
      logger.warn("session-hydration-skipped-anon", {
        session_id: session.sessionId,
      });
      trackEvent("session-hydration-rejected", {
        requestId,
        reason: "anon-hydration-forbidden" satisfies HydrationRejectReason,
      });
      // Drop the freshly-minted session from the store so a rejected anon
      // hydration does not leave residue under an attacker-chosen id.
      try { sessionStore.delete(session.sessionId); } catch { /* ignore */ }
      return new Response(
        JSON.stringify({
          error: "Anonymous hydration not permitted",
          code: "HYDRATION_ANON_FORBIDDEN",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    } else {
      // Sanitize + guardrail-scan each hydrated turn. Hydration is fail-closed:
      // any block on any turn → 400 HYDRATION_BLOCKED_BY_GUARDRAIL and the
      // freshly-minted session is dropped from the store (no poisoning residue).
      const inputGuardrails = (() => {
        try { return registry.getGuardrailsByStage("input"); } catch { return []; }
      })();
      const sanitized: ClientHydrationMessage[] = [];
      for (const m of validatedMessages) {
        const clean = sanitizeText(m.content);
        // Guardrail only user turns at input stage (assistant turns don't
        // flow through `input` guardrails in the runner either).
        if (m.role === "user" && inputGuardrails.length > 0) {
          let guardResult;
          try {
            guardResult = await runGuardrails(
              "input",
              { stage: "input", userMessage: clean },
              inputGuardrails,
              session.activeAgent,
            );
          } catch {
            // runGuardrails is already fail-closed, but be defensive.
            guardResult = { blocked: true, mutatedInput: { stage: "input" as const, userMessage: clean } };
          }
          if (guardResult.blocked) {
            logger.warn("session-hydration-rejected", {
              session_id: session.sessionId,
              reason: "blocked-by-guardrail",
            });
            trackEvent("session-hydration-rejected", {
              requestId,
              reason: "blocked-by-guardrail" satisfies HydrationRejectReason,
            });
            try { sessionStore.delete(session.sessionId); } catch { /* ignore */ }
            return new Response(
              JSON.stringify({
                error: "Request could not be completed",
                code: "HYDRATION_BLOCKED_BY_GUARDRAIL",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }
          const muted = guardResult.mutatedInput.userMessage;
          sanitized.push({ role: "user", content: typeof muted === "string" ? muted : clean });
        } else {
          sanitized.push({ role: m.role, content: clean });
        }
      }
      const result = hydrateColdSession(session, sanitized, { enabled: true });
      logger.info("session-hydrated", {
        session_id: session.sessionId,
        turn_count: result.hydrated,
        user_turn_count: sanitized.filter((m) => m.role === "user").length,
        assistant_turn_count: sanitized.filter((m) => m.role === "assistant").length,
      });
      trackEvent("session-hydrated", {
        requestId,
        turnCount: String(result.hydrated),
        userTurnCount: String(sanitized.filter((m) => m.role === "user").length),
        assistantTurnCount: String(sanitized.filter((m) => m.role === "assistant").length),
      });
    }
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
